use swc_core::{atoms::Atom, common::{ SyntaxContext, util::take::Take }, ecma::{
    ast::{ArrowExpr, BlockStmt, CallExpr, Expr, Ident, Program, ReturnStmt, VarDecl, VarDeclarator},
    transforms::testing::test_inline,
    visit::{ VisitMut, VisitMutWith, visit_mut_pass },
}};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};

pub struct TransformVisitor;

impl VisitMut for TransformVisitor {
    fn visit_mut_expr(&mut self, node: &mut swc_core::ecma::ast::Expr) {
        node.visit_mut_children_with(self);

        let Some(arrow_expr) = (match node {
            Expr::Arrow(arrow_expr) => Some(arrow_expr.take()),
            _ => None,
        }) else { return; };

        let mut stmt = BlockStmt::default();

        let closure_ident = Ident::new_private(Atom::new("closure"), Default::default());

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

        stmt.stmts.push(ReturnStmt {
            arg: Some(Box::new(closure_ident.into())),
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
