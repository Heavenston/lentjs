use std::collections::HashSet;

use swc_core::{atoms::{Atom, Wtf8Atom}, common::{ SyntaxContext, util::take::Take }, ecma::{
    ast::{ArrayLit, ArrowExpr, AssignExpr, BlockStmt, CallExpr, Expr, ExprOrSpread, ExprStmt, Id, Ident, MemberExpr, Program, ReturnStmt, VarDecl, VarDeclarator},
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

pub struct TransformVisitor;

impl VisitMut for TransformVisitor {
    fn visit_mut_expr(&mut self, node: &mut swc_core::ecma::ast::Expr) {
        let Some(mut arrow_expr) = (match node {
            Expr::Arrow(arrow_expr) => Some(arrow_expr.take()),
            _ => None,
        }) else {
            node.visit_mut_children_with(self);
            return;
        };

        let mut captured_values = FindCapturedValues::default();
        arrow_expr.visit_mut_with(&mut captured_values);
        arrow_expr.visit_mut_children_with(self);

        let mut stmt = BlockStmt::default();

        let closure_ident = Ident::new_private(Atom::new("__closure"), Default::default());
        let closure_expr = Box::<Expr>::new(closure_ident.clone().into());

        stmt.stmts.push(VarDecl {
            kind: swc_core::ecma::ast::VarDeclKind::Const,
            decls: vec![
                VarDeclarator {
                    name: closure_ident.clone().into(),
                    init: Some(Box::new(arrow_expr.into())),
                    ..Take::dummy()
                },
            ],
            ..Default::default()
        }.into());

        let values: Vec<Option<ExprOrSpread>> = captured_values.values.iter()
            .filter(|p| !captured_values.decls.contains(p))
            .map(|(a, c)| format!("{a}{c:?}"))
            .map(|p| swc_core::ecma::ast::Str {
                value: Wtf8Atom::from(p),
                span: Default::default(),
                raw: None,
            })
            .map(|p| Some(ExprOrSpread::from(Expr::from(p))))
            .collect();
        let decls: Vec<Option<ExprOrSpread>> = captured_values.decls.iter()
            .map(|(a, c)| format!("{a}{c:?}"))
            .map(|p| swc_core::ecma::ast::Str {
                value: Wtf8Atom::from(p),
                span: Default::default(),
                raw: None,
            })
            .map(|p| Some(ExprOrSpread::from(Expr::from(p))))
            .collect();

        stmt.stmts.push(ExprStmt {
            expr: Box::new(AssignExpr {
                left: MemberExpr {
                    obj: closure_expr.clone(),
                    prop: swc_core::ecma::ast::MemberProp::Ident(Atom::new("values").into()),
                    ..Default::default()
                }.into(),
                right: ArrayLit {
                    elems: values,
                    ..Default::default()
                }.into(),
                ..Default::default()
            }.into()),
            ..Default::default()
        }.into());
        stmt.stmts.push(ExprStmt {
            expr: Box::new(AssignExpr {
                left: MemberExpr {
                    obj: closure_expr.clone(),
                    prop: swc_core::ecma::ast::MemberProp::Ident(Atom::new("decls").into()),
                    ..Default::default()
                }.into(),
                right: ArrayLit {
                    elems: decls,
                    ..Default::default()
                }.into(),
                ..Default::default()
            }.into()),
            ..Default::default()
        }.into());

        stmt.stmts.push(ReturnStmt {
            arg: Some(closure_expr.clone()),
            ..Default::default()
        }.into());

        *node = CallExpr {
            callee: swc_core::ecma::ast::Callee::Expr(ArrowExpr {
                body: Box::new(stmt.into()),
                ..Default::default()
            }.into()),
            ..Default::default()
        }.into();
    }
}

/// An example plugin function with macro support.
/// `plugin_transform` macro interop pointers into deserialized structs, as well
/// as returning ptr back to host.
///
/// It is possible to opt out from macro by writing transform fn manually
/// if plugin need to handle low-level ptr directly via
/// `__transform_plugin_process_impl(
///     ast_ptr: *const u8, ast_ptr_len: i32,
///     unresolved_mark: u32, should_enable_comments_proxy: i32) ->
///     i32 /*  0 for success, fail otherwise.
///             Note this is only for internal pointer interop result,
///             not actual transform result */`
///
/// This requires manual handling of serialization / deserialization from ptrs.
/// Refer swc_plugin_macro to see how does it work internally.
#[plugin_transform]
pub fn process_transform(mut program: Program, _metadata: TransformPluginProgramMetadata) -> Program {
    program.visit_mut_with(&mut TransformVisitor);
    program
}

// An example to test plugin transform.
// Recommended strategy to test plugin's transform is verify
// the Visitor's behavior, instead of trying to run `process_transform` with mocks
// unless explicitly required to do so.
test_inline!(
    Default::default(),
    |_| visit_mut_pass(TransformVisitor),
    boo,
    // Input codes
    r#"{ const feur = "bonjour"; () => feur }"#,
    // Output codes after transformed with plugin
    r#"() => {
        return () => "test";
    }"#
);
