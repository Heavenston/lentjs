use swc_core::ecma::{ast::{Expr, ExprOrSpread, Lit}, visit::{VisitMut, VisitMutWith}};
use crate::lentjs_idents_importer::LentjsIdentsImporter;

pub struct RegisterDollarMagic<'a> {
    importer: &'a mut LentjsIdentsImporter,
}

impl<'a> RegisterDollarMagic<'a> {
    pub fn new(importer: &'a mut LentjsIdentsImporter) -> Self {
        Self { importer }
    }
}

impl VisitMut for RegisterDollarMagic<'_> {
    fn visit_mut_call_expr(&mut self, node: &mut swc_core::ecma::ast::CallExpr) {
        node.visit_mut_children_with(self);

        let is_register_dollar = node.callee.as_expr().and_then(|e| e.as_ident()).is_some_and(|p| p.sym == "register$");

        if is_register_dollar && node.args.len() == 1 {
            node.callee = Box::<Expr>::new(self.importer.get(crate::lentjs_idents_importer::LentjsIdent::Register).into()).into();
            node.args.push(ExprOrSpread::from(Expr::Lit(Lit::Str("____RANDOM_ID".into()))));
        }
    }
}
