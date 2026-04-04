use std::collections::{HashMap, HashSet};

use swc_core::{atoms::{Atom, Wtf8Atom}, common::{ Span, SyntaxContext, util::take::Take }, ecma::{
    ast::{ArrayLit, ArrowExpr, AssignExpr, BlockStmt, CallExpr, Expr, ExprOrSpread, ExprStmt, Id, Ident, MemberExpr, MemberProp, Null, Pat, Program, ReturnStmt, VarDecl, VarDeclarator},
    transforms::testing::test_inline,
    visit::{ VisitMut, VisitMutWith, visit_mut_pass },
}};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};

#[derive(Default)]
struct FindCapturedValues {
    is_in_decl: bool,
    decls: HashSet<Id>,
    values: HashSet<Id>,
}

impl VisitMut for FindCapturedValues {
    fn visit_mut_var_declarator(&mut self, node: &mut VarDeclarator) {
        node.init.visit_mut_with(self);

        let prev = self.is_in_decl;
        self.is_in_decl = true;
        node.name.visit_mut_children_with(self);
        self.is_in_decl = prev;
    }

    fn visit_mut_arrow_expr(&mut self, node: &mut ArrowExpr) {
        let prev = self.is_in_decl;
        self.is_in_decl = true;
        node.params.visit_mut_with(self);
        self.is_in_decl = prev;

        node.body.visit_mut_with(self);
        node.type_params.visit_mut_with(self);
        node.return_type.visit_mut_with(self);
    }

    fn visit_mut_ident(&mut self, ident: &mut Ident) {
        let id = Id::from(ident.clone());
        if id.1.as_u32() == 1 { return; }
        if self.is_in_decl {
            self.decls.insert(id);
        }
        else {
            self.values.insert(id);
        }
    }
}

struct IdentReplacer<'a> {
    mappings: &'a HashMap<Id, Id>,
}

impl VisitMut for IdentReplacer<'_> {
    fn visit_mut_ident(&mut self, ident: &mut Ident) {
        let id: Id = ident.clone().into();
        if let Some((new_atom, new_ctxt)) = self.mappings.get(&id) {
            ident.sym = new_atom.clone();
            ident.ctxt = *new_ctxt;
        }
    }
}

struct HoistedClosure {
    chosen_name: Ident,
    code: ArrowExpr,
}

#[derive(Default)]
pub struct TransformVisitor {
    enabled: bool,
    hoisted_closured: Vec<HoistedClosure>,
}

impl VisitMut for TransformVisitor {
    fn visit_mut_script(&mut self, _node: &mut swc_core::ecma::ast::Script) {
        panic!("Script are not supported");
    }

    fn visit_mut_stmts(&mut self, node: &mut Vec<swc_core::ecma::ast::Stmt>) {
        let enable_directive = node.first()
            .and_then(|stmt| stmt.as_expr())
            .and_then(|expr_stmt| expr_stmt.expr.as_lit())
            .and_then(|lit| lit.as_str())
            .is_some_and(|ss| ss.value == "use component");

        let old_enabled = self.enabled;
        self.enabled = enable_directive;
        node.visit_mut_children_with(self);
        self.enabled = old_enabled;
    }

    fn visit_mut_module_items(&mut self, items: &mut Vec<swc_core::ecma::ast::ModuleItem>) {
        items.visit_mut_children_with(self);
        let insert_point = items.iter().enumerate().find(|p| p.1.is_stmt()).map(|(idx, _)| idx).unwrap_or(items.len());

        if !self.hoisted_closured.is_empty() {
            items.insert(insert_point, Box::new(VarDecl {
                kind: swc_core::ecma::ast::VarDeclKind::Const,
                decls: self.hoisted_closured.drain(..).map(|h| {
                    VarDeclarator {
                        span: Default::default(),
                        name: swc_core::ecma::ast::Pat::Ident(swc_core::ecma::ast::BindingIdent { id: h.chosen_name, type_ann: None }),
                        init: Some(Box::new(h.code.into())),
                        definite: false,
                    }
                }).collect(),
                ..Default::default()
            }).into());
        }
    }

    fn visit_mut_expr(&mut self, node: &mut swc_core::ecma::ast::Expr) {
        if !self.enabled {
            return node.visit_mut_children_with(self);
        }

        let Some(mut arrow_expr) = (match node {
            Expr::Arrow(arrow_expr) => Some(arrow_expr.take()),
            _ => None,
        }) else {
            node.visit_mut_children_with(self);
            return;
        };

        let mut captured_values = {
            let mut v = FindCapturedValues::default();
            arrow_expr.visit_mut_with(&mut v);
            v
        };

        // Remove all values that are declared within the arrow function
        captured_values.values.retain(|o| !captured_values.decls.contains(o));

        let chosen_name = Ident::new_private(Atom::new("__hoisted"), Span::dummy());

        let captured_mappings: HashMap<Id, Id> = captured_values.values.iter()
            .map(|id| (id.clone(), Ident::from(id.clone()).into_private().into()))
            .collect();

        arrow_expr.visit_mut_with(&mut IdentReplacer {
            mappings: &captured_mappings,
        });
        arrow_expr.params = std::iter::chain(
            captured_mappings.values().cloned().map(Ident::from).map(|id| Pat::Ident(id.into())),
            arrow_expr.params.drain(..),
        ).collect();
        arrow_expr.visit_mut_children_with(self);

        *node = if captured_mappings.is_empty() {
            chosen_name.clone().into()
        } else {
            CallExpr {
                callee: Box::<Expr>::new(MemberExpr {
                    span: Span::default(),
                    obj: Box::<Expr>::new(chosen_name.clone().into()).into(),
                    prop: MemberProp::Ident(Atom::new("bind").into()),
                }.into()).into(),
                args: std::iter::chain(
                    std::iter::once(Expr::Lit(Null::dummy().into()).into()),
                    captured_mappings.keys().cloned().map(Ident::from)
                        .map(|id| Expr::from(id)),
                ).map(ExprOrSpread::from).collect(),
                ..Default::default()
            }.into()
        };

        self.hoisted_closured.push(HoistedClosure {
            chosen_name: chosen_name.clone(),
            code: arrow_expr.clone(),
        });
    }
}

#[plugin_transform]
pub fn process_transform(mut program: Program, _metadata: TransformPluginProgramMetadata) -> Program {
    program.visit_mut_with(&mut TransformVisitor::default());
    program
}
