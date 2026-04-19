// False positive
#![allow(unreachable_patterns)]

mod jsx;
mod jsx_whitespace;
mod lentjs_idents_importer;
mod register_dollar_magic;

use std::collections::{HashMap, HashSet};

use swc_core::{atoms::{Atom, Wtf8Atom}, common::{ Span, util::take::Take }, ecma::{
    ast::{ArrowExpr, CallExpr, Expr, ExprOrSpread, Id, Ident, ImportSpecifier, MemberExpr, MemberProp, ModuleDecl, ModuleItem, Null, Pat, Program, Stmt, VarDecl, VarDeclarator},
    visit::{ Visit, VisitMut, VisitMutWith, VisitWith },
}};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};

use crate::{lentjs_idents_importer::LentjsIdentsImporter, register_dollar_magic::RegisterDollarMagic};

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
        // ignore global scope idents
        if ident.ctxt.as_u32() == 1 { return; }
        // ignore top-level (module) scope idents
        if ident.ctxt.as_u32() == 2 { return; }

        let id = Id::from(ident.clone());
        if self.is_in_decl {
            self.decls.insert(id);
        }
        else {
            self.values.insert(id);
        }
    }
}

struct IdentReplacer {
    mappings: HashMap<Id, Id>,
}

impl VisitMut for IdentReplacer {
    fn visit_mut_ident(&mut self, ident: &mut Ident) {
        let id: Id = ident.clone().into();
        if let Some((new_atom, new_ctxt)) = self.mappings.get(&id) {
            ident.sym = new_atom.clone();
            ident.ctxt = *new_ctxt;
        }
    }
}

/// Finds and store a list of all idents that are defined at the top-level of a module
#[derive(Default)]
struct FindTopLevelIdents {
    idens: HashSet<Id>,
}

impl FindTopLevelIdents {
    fn collect_pat_idents(&mut self, pat: &Pat) {
        match pat {
            Pat::Ident(bind) => {
                self.idens.insert(bind.id.to_id());
            }
            Pat::Array(arr) => {
                for elem in arr.elems.iter().flatten() {
                    self.collect_pat_idents(elem);
                }
            }
            Pat::Object(obj) => {
                for prop in &obj.props {
                    match prop {
                        swc_core::ecma::ast::ObjectPatProp::KeyValue(kv) => {
                            self.collect_pat_idents(&kv.value);
                        }
                        swc_core::ecma::ast::ObjectPatProp::Assign(assign) => {
                            self.idens.insert(assign.key.to_id());
                        }
                        swc_core::ecma::ast::ObjectPatProp::Rest(rest) => {
                            self.collect_pat_idents(&rest.arg);
                        }
                        _ => unimplemented!(),
                    }
                }
            }
            Pat::Rest(rest) => {
                self.collect_pat_idents(&rest.arg);
            }
            Pat::Assign(assign) => {
                self.collect_pat_idents(&assign.left);
            }
            Pat::Expr(_) | Pat::Invalid(_) => {}
            _ => unimplemented!(),
        }
    }

    fn collect_decl_idents(&mut self, decl: &swc_core::ecma::ast::Decl) {
        match decl {
            swc_core::ecma::ast::Decl::Class(c) => {
                self.idens.insert(c.ident.to_id());
            }
            swc_core::ecma::ast::Decl::Fn(f) => {
                self.idens.insert(f.ident.to_id());
            }
            swc_core::ecma::ast::Decl::Var(v) => {
                for declarator in &v.decls {
                    self.collect_pat_idents(&declarator.name);
                }
            }
            _ => {}
        }
    }
}

impl Visit for FindTopLevelIdents {
    fn visit_module_decl(&mut self, node: &ModuleDecl) {
        match node {
            ModuleDecl::Import(import_decl) => {
                for spec in &import_decl.specifiers {
                    match spec {
                        ImportSpecifier::Named(s) => {
                            self.idens.insert(s.local.to_id());
                        }
                        ImportSpecifier::Default(s) => {
                            self.idens.insert(s.local.to_id());
                        }
                        ImportSpecifier::Namespace(s) => {
                            self.idens.insert(s.local.to_id());
                        }
                        _ => unimplemented!(),
                    }
                }
            }
            ModuleDecl::ExportDecl(export_decl) => {
                self.collect_decl_idents(&export_decl.decl);
            }
            ModuleDecl::ExportDefaultDecl(export_default) => {
                match &export_default.decl {
                    swc_core::ecma::ast::DefaultDecl::Class(c) => {
                        if let Some(ident) = &c.ident {
                            self.idens.insert(ident.to_id());
                        }
                    }
                    swc_core::ecma::ast::DefaultDecl::Fn(f) => {
                        if let Some(ident) = &f.ident {
                            self.idens.insert(ident.to_id());
                        }
                    }
                    _ => {}
                }
            }
            // ExportDefaultExpr, ExportAll, ExportNamed, TS-specific — no new local bindings
            _ => {}
        }
    }

    fn visit_stmt(&mut self, node: &Stmt) {
        // Only extract declarations; do NOT recurse into children
        // so that nested declarations are not included.
        if let Stmt::Decl(decl) = node {
            self.collect_decl_idents(decl);
        }
    }
}

struct HoistedClosure {
    chosen_name: Ident,
    code: ArrowExpr,
}

pub struct TransformVisitor<'a> {
    importer: &'a mut LentjsIdentsImporter,
    enabled: bool,
    /// Stores a list of idents that are defined at the top level
    /// Such idens do not need to be captured by closures
    top_level_idents: HashSet<Id>,
    hoisted_closured: Vec<HoistedClosure>,
}

impl<'a> TransformVisitor<'a> {
    pub fn new(importer: &'a mut LentjsIdentsImporter) -> Self {
        Self {
            importer,
            enabled: Default::default(),
            top_level_idents: Default::default(),
            hoisted_closured: Default::default(),
        }
    }
}

impl VisitMut for TransformVisitor<'_> {
    fn visit_mut_script(&mut self, _node: &mut swc_core::ecma::ast::Script) {
        panic!("Script are not supported");
    }

    fn visit_mut_module(&mut self, node: &mut swc_core::ecma::ast::Module) {
        let mut find = FindTopLevelIdents::default();
        node.visit_with(&mut find);
        self.top_level_idents = find.idens;
        node.visit_mut_children_with(self);
    }

    fn visit_mut_call_expr(&mut self, node: &mut CallExpr) {
        let is_register_dollar = node.callee.as_expr().and_then(|e| e.as_ident()).is_some_and(|p| p.sym == "register$");

        let old_enabled = self.enabled;
        self.enabled = is_register_dollar || old_enabled;
        node.visit_mut_children_with(self);
        self.enabled = old_enabled;
    }

    fn visit_mut_stmts(&mut self, node: &mut Vec<swc_core::ecma::ast::Stmt>) {
        let enable_directive = node.first()
            .and_then(|stmt| stmt.as_expr())
            .and_then(|expr_stmt| expr_stmt.expr.as_lit())
            .and_then(|lit| lit.as_str())
            .is_some_and(|ss| ss.value == "use component");

        let old_enabled = self.enabled;
        self.enabled = enable_directive || old_enabled;
        node.visit_mut_children_with(self);
        self.enabled = old_enabled;
    }

    fn visit_mut_module_items(&mut self, items: &mut Vec<swc_core::ecma::ast::ModuleItem>) {
        items.visit_mut_children_with(self);
        let insert_point = items.iter().enumerate().find(|(_, p)| match *p {
            ModuleItem::ModuleDecl(module_decl) => match module_decl {
                ModuleDecl::Import(_) | ModuleDecl::TsImportEquals(_) => false,
                _ => true,
            },
            _ => true,
        }).map(|(idx, _)| idx).unwrap_or(items.len());

        if self.hoisted_closured.is_empty() {
            return;
        }
        
        items.insert(insert_point, Box::new(VarDecl {
            kind: swc_core::ecma::ast::VarDeclKind::Const,
            decls: self.hoisted_closured.drain(..).map(|h| {
                let init: Expr = CallExpr {
                    callee: swc_core::ecma::ast::Callee::Expr(self.importer.get(lentjs_idents_importer::LentjsIdent::Register).clone().into()),
                    args: vec![
                        ExprOrSpread::from(Box::new(h.code.into())),
                        ExprOrSpread::from(Box::new(swc_core::ecma::ast::Str {
                            span: Span::dummy(),
                            value: Wtf8Atom::new("____RANDOM_ID"),
                            raw: None,
                        }.into())),
                    ],
                    ..Default::default()
                }.into();

                VarDeclarator {
                    span: Default::default(),
                    name: swc_core::ecma::ast::Pat::Ident(swc_core::ecma::ast::BindingIdent { id: h.chosen_name, type_ann: None }),
                    init: Some(Box::new(init)),
                    definite: false,
                }
            }).collect(),
            ..Default::default()
        }).into());
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
        captured_values.values.retain(|o| !captured_values.decls.contains(o) && !self.top_level_idents.contains(o) && !self.importer.is_ident(o));

        let chosen_name = Ident::new_private(Atom::new("h"), Span::dummy());

        let mut captured_mappings: Vec<(Id, Id)> = captured_values.values.iter()
            .map(|id| (id.clone(), Ident::from(id.clone()).into_private().into()))
            .collect();
        // Ordering needs to be deterministic
        captured_mappings.sort_unstable();

        arrow_expr.visit_mut_with(&mut IdentReplacer {
            mappings: captured_mappings.iter().cloned().collect(),
        });
        arrow_expr.params = std::iter::chain(
            captured_mappings.iter().map(|a| &a.1).cloned().map(Ident::from).map(|id| Pat::Ident(id.into())),
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
                    captured_mappings.iter().map(|a| &a.0).cloned().map(Ident::from)
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
    let mut lentjs_idents_importer = LentjsIdentsImporter::default();
    program.visit_mut_with(&mut jsx::JsxTransform::new(&mut lentjs_idents_importer));
    program.visit_mut_with(&mut TransformVisitor::new(&mut lentjs_idents_importer));
    program.visit_mut_with(&mut RegisterDollarMagic::new(&mut lentjs_idents_importer));
    lentjs_idents_importer.insert_import_decl(program.as_mut_module().expect("Only modules are supported"));
    program
}
