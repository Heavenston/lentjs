///! Code in this module is largely AI-Generated but with a few tweaks

use swc_core::{atoms::{Atom, Wtf8Atom}, common::{ Span, util::take::Take }, ecma::{
    ast::{Bool, CallExpr, Callee, Expr, ExprOrSpread, Ident, ImportDecl, ImportNamedSpecifier, ImportSpecifier, JSXAttrName, JSXAttrOrSpread, JSXAttrValue, JSXElement, JSXElementChild, JSXElementName, JSXExpr, JSXFragment, JSXMemberExpr, JSXObject, KeyValueProp, Lit, MemberExpr, MemberProp, Module, ModuleDecl, ModuleItem, Null, ObjectLit, Prop, PropName, PropOrSpread, Str},
    visit::{ VisitMut, VisitMutWith },
}};

use crate::jsx_whitespace::collapse_jsx_whitespace;

const IMPORT_SOURCE: &str = "@lentjs/core";
const FACTORY_NAME: &str = "h";
const FRAGMENT_NAME: &str = "Fragment";

#[derive(Default)]
pub struct JsxTransform {
    factory_ident: Option<Ident>,
    fragment_ident: Option<Ident>,
}

impl VisitMut for JsxTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        module.visit_mut_children_with(self);

        let mut specifiers = Vec::new();
        if let Some(factory_ident) = self.factory_ident.clone() {
            specifiers.push(ImportSpecifier::Named(ImportNamedSpecifier {
                span: Span::dummy(),
                local: factory_ident.clone(),
                imported: Some(swc_core::ecma::ast::ModuleExportName::Ident(Ident::from(factory_ident))),
                is_type_only: false,
            }));
        }
        if let Some(fragment_ident) = self.fragment_ident.clone() {
            specifiers.push(ImportSpecifier::Named(ImportNamedSpecifier {
                span: Span::dummy(),
                local: fragment_ident.clone(),
                imported: Some(swc_core::ecma::ast::ModuleExportName::Ident(Ident::from(fragment_ident))),
                is_type_only: false,
            }));
        }

        if specifiers.is_empty() {
            return;
        }

        let import = ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: Span::dummy(),
            specifiers,
            src: Box::new(Str::from(IMPORT_SOURCE)),
            type_only: false,
            with: None,
            phase: Default::default(),
        }));
        module.body.insert(0, import);
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        // Transform children first (bottom-up).
        expr.visit_mut_children_with(self);

        match expr.take() {
            Expr::JSXElement(el) => {
                *expr = self.transform_element(*el);
            }
            Expr::JSXFragment(frag) => {
                *expr = self.transform_fragment(frag);
            }
            other => {
                *expr = other;
            }
        }
    }
}

impl JsxTransform {
    fn get_factory_ident(&mut self) -> Ident {
        self.factory_ident.get_or_insert_with(|| Ident::new_private(Atom::new(FACTORY_NAME), Span::dummy())).clone()
    }

    fn get_fragment_ident(&mut self) -> Ident {
        self.fragment_ident.get_or_insert_with(|| Ident::new_private(Atom::new(FRAGMENT_NAME), Span::dummy())).clone()
    }

    /// `<Foo bar="baz">child</Foo>`
    /// → `createElement(Foo, { bar: "baz" }, "child")`
    fn transform_element(&mut self, el: JSXElement) -> Expr {
        let tag = self.jsx_name_to_expr(el.opening.name);
        let children = self.build_children(el.children);
        let props = self.build_props(el.opening.attrs, children, el.opening.span);

        self.make_create_element_call(tag, props, el.opening.span)
    }

    /// `<>child</>`
    /// → `createElement(Fragment, null, "child")`
    fn transform_fragment(&mut self, frag: JSXFragment) -> Expr {
        let tag = Expr::Ident(self.get_fragment_ident());
        let children = self.build_children(frag.children);
        let props = self.build_props(vec![], children, frag.opening.span);

        self.make_create_element_call(tag, props, frag.opening.span)
    }

    /// Build the final `createElement(tag, props, ...children)` call.
    fn make_create_element_call(
        &mut self,
        tag: Expr,
        props: Expr,
        span: swc_core::common::Span,
    ) -> Expr {
        let args: Vec<ExprOrSpread> = vec![
            ExprOrSpread {
                spread: None,
                expr: Box::new(tag),
            },
            ExprOrSpread {
                spread: None,
                expr: Box::new(props),
            },
        ];

        Expr::Call(CallExpr {
            span,
            callee: Callee::Expr(Box::new(Expr::Ident(self.get_factory_ident()))),
            args,
            ..Default::default()
        })
    }

    /// Lowercase ident → string literal (`"div"`).
    /// Uppercase ident → identifier (`Component`).
    /// Member expr (`Foo.Bar`) → member expression.
    fn jsx_name_to_expr(&mut self, name: JSXElementName) -> Expr {
        match name {
            JSXElementName::Ident(id) => {
                let first = id.sym.chars().next().unwrap_or('a');
                if first.is_lowercase() {
                    Expr::Lit(Lit::Str(Str {
                        span: id.span,
                        value: id.sym.into(),
                        raw: None,
                    }))
                } else {
                    Expr::Ident(id.into())
                }
            }
            JSXElementName::JSXMemberExpr(m) => self.jsx_member_to_expr(m),
            _ => unimplemented!(),
        }
    }

    /// Recursively convert `JSXMemberExpr` → `MemberExpr`.
    /// Handles `A.B.C` chains.
    fn jsx_member_to_expr(&mut self, m: JSXMemberExpr) -> Expr {
        let obj: Box<Expr> = match m.obj {
            JSXObject::Ident(id) => Box::new(Expr::Ident(id.into())),
            JSXObject::JSXMemberExpr(nested) => Box::new(self.jsx_member_to_expr(*nested)),
            _ => unimplemented!(),
        };
        Expr::Member(MemberExpr {
            span: Span::dummy(),
            obj,
            prop: MemberProp::Ident(m.prop),
        })
    }

    fn build_props(&mut self, attrs: Vec<JSXAttrOrSpread>, mut children: Vec<Box<Expr>>, span: swc_core::common::Span) -> Expr {
        let mut props: Vec<PropOrSpread> = attrs
            .into_iter()
            .map(|attr| match attr {
                JSXAttrOrSpread::JSXAttr(a) => {
                    let key = match a.name {
                        JSXAttrName::Ident(id) => PropName::Ident(id),
                        JSXAttrName::JSXNamespacedName(p) => PropName::Str(Str { span: p.span, value: Wtf8Atom::new(format!("{}:{}", p.ns.sym, p.name.sym)), raw: None }),
                        _ => unimplemented!(),
                    };
                    let value = self.jsx_attr_value_to_expr(a.value);
                    PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                        key,
                        value: Box::new(value),
                    })))
                }
                JSXAttrOrSpread::SpreadElement(s) => PropOrSpread::Spread(s),
                _ => unimplemented!(),
            })
            .collect();

        if !children.is_empty() {
            if children.len() == 1 {
                props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp { key: PropName::Str("children".into()), value: children.remove(0) }))));
            }
            else {
                props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp { key: PropName::Str("children".into()), value: Box::new(Expr::Array(swc_core::ecma::ast::ArrayLit {
                    span: Span::dummy(),
                    elems: children.into_iter().map(ExprOrSpread::from).map(Some).collect(),
                })) }))));
            }
        }

        Expr::Object(ObjectLit { span, props })
    }

    /// Convert an attribute value to an expression.
    /// `None` (boolean shorthand like `<input disabled />`) → `true`.
    fn jsx_attr_value_to_expr(&mut self, value: Option<JSXAttrValue>) -> Expr {
        match value {
            None => Expr::Lit(Lit::Bool(Bool {
                span: Span::dummy(),
                value: true,
            })),
            Some(JSXAttrValue::Str(f)) => Expr::Lit(Lit::Str(f)),
            Some(JSXAttrValue::JSXExprContainer(c)) => match c.expr {
                JSXExpr::Expr(e) => *e,
                JSXExpr::JSXEmptyExpr(_) => Expr::Lit(Lit::Bool(Bool {
                    span: Span::dummy(),
                    value: true,
                })),
                _ => unimplemented!(),
            },
            Some(JSXAttrValue::JSXElement(el)) => self.transform_element(*el),
            Some(JSXAttrValue::JSXFragment(f)) => self.transform_fragment(f),
            _ => unimplemented!(),
        }
    }

    fn build_children(&mut self, children: Vec<JSXElementChild>) -> Vec<Box<Expr>> {
        children
            .into_iter()
            .filter_map(|child| {
                let expr: Expr = match child {
                    JSXElementChild::JSXText(text) => {
                        let Some(s) = collapse_jsx_whitespace(&text.value)
                        else { return None; };
                        Expr::Lit(Lit::Str(Str {
                            span: text.span,
                            value: s.into(),
                            raw: None,
                        }))
                    }
                    JSXElementChild::JSXExprContainer(c) => match c.expr {
                        JSXExpr::Expr(e) => *e,
                        JSXExpr::JSXEmptyExpr(_) => return None,
                        _ => unimplemented!(),
                    },
                    JSXElementChild::JSXElement(el) => self.transform_element(*el),
                    JSXElementChild::JSXFragment(f) => self.transform_fragment(f),
                    JSXElementChild::JSXSpreadChild(s) => {
                        // Spread children: `<div>{...items}</div>`
                        // React doesn't actually support JSXSpreadChild in the
                        // classic transform. We pass it through as a spread arg.
                        return Some(s.expr);
                    }
                    _ => unimplemented!(),
                };

                Some(Box::new(expr))
            })
            .collect()
    }
}
