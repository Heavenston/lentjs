use std::collections::{HashMap, HashSet};

///! Code in this module is largely AI-Generated but with a few tweaks

use swc_core::{atoms::{Atom, Wtf8Atom}, common::{ Span, util::take::Take }, ecma::{
    ast::{Bool, CallExpr, Callee, Expr, ExprOrSpread, Id, Ident, ImportDecl, ImportNamedSpecifier, ImportSpecifier, JSXAttrName, JSXAttrOrSpread, JSXAttrValue, JSXElement, JSXElementChild, JSXElementName, JSXExpr, JSXFragment, JSXMemberExpr, JSXObject, KeyValueProp, Lit, MemberExpr, MemberProp, Module, ModuleDecl, ModuleItem, ObjectLit, Prop, PropName, PropOrSpread, Stmt, Str},
    visit::{ Visit, VisitMut, VisitMutWith, VisitWith },
}};

use crate::jsx_whitespace::collapse_jsx_whitespace;

const IMPORT_SOURCE: &str = "@lentjs/core";
const FACTORY_NAME: &str = "h";
const FRAGMENT_NAME: &str = "Fragment";
const CHILDREN_ARRAY_NAME: &str = "ChildernArray";

/// Tries to chose wether or not an expression may invoke any reactive code.
/// This may happen because of signals, or stores, so we detect function calls
/// and member expression.
#[derive(Default)]
struct ExpressionNeedsWrapping {
    filter_list: HashSet<Id>,
    found_dynamic: bool,
}

impl Visit for ExpressionNeedsWrapping {
    fn visit_arrow_expr(&mut self, _node: &swc_core::ecma::ast::ArrowExpr) {
        // We do not visit function bodies
    }

    fn visit_function(&mut self, _node: &swc_core::ecma::ast::Function) {
        // We do not visit function bodies
    }

    fn visit_fn_expr(&mut self, _node: &swc_core::ecma::ast::FnExpr) {
        // We do not visit function bodies
    }

    fn visit_fn_decl(&mut self, _node: &swc_core::ecma::ast::FnDecl) {
        // We do not visit function bodies
    }

    fn visit_call_expr(&mut self, node: &CallExpr) {
        let ignore = node.callee.as_expr().and_then(|e| e.as_ident()).is_some_and(|i| self.filter_list.contains(&i.clone().into()));
        if !ignore {
            self.found_dynamic = true;
        }
    }

    fn visit_member_expr(&mut self, _node: &MemberExpr) {
        self.found_dynamic = true;
    }
}

#[derive(Default)]
pub struct JsxTransform {
    idents: HashMap<String, Ident>,
}

impl VisitMut for JsxTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        module.visit_mut_children_with(self);

        let mut specifiers = Vec::new();
        for (name, ident) in &self.idents {
            specifiers.push(ImportSpecifier::Named(ImportNamedSpecifier {
                span: Span::dummy(),
                local: ident.clone(),
                imported: Some(swc_core::ecma::ast::ModuleExportName::Ident(Ident::from(name.as_str()))),
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
    fn get_lentjs_ident(&mut self, name: &str) -> Ident {
        if let Some(v) = self.idents.get(name) {
            v.clone()
        }
        else {
            let ident = Ident::new_private(Atom::new(FACTORY_NAME), Span::dummy());
            self.idents.insert(name.to_string(), ident.clone());
            ident
        }
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
        let tag = Expr::Ident(self.get_lentjs_ident(FRAGMENT_NAME));
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
            callee: Callee::Expr(Box::new(Expr::Ident(self.get_lentjs_ident(FACTORY_NAME)))),
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
                    if self.expr_needs_wrapping(&value) {
                       PropOrSpread::Prop(Box::new(Prop::Getter(swc_core::ecma::ast::GetterProp {
                            key,
                            body: Some(swc_core::ecma::ast::BlockStmt {
                                stmts: vec![Stmt::Return(swc_core::ecma::ast::ReturnStmt {
                                    arg: Some(Box::new(value)),
                                    ..Default::default()
                                })],
                                ..Default::default()
                            }),
                            ..Default::default()
                        })))     
                    }
                    else {
                        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key,
                            value: Box::new(value),
                        })))
                    }
                }
                JSXAttrOrSpread::SpreadElement(s) => PropOrSpread::Spread(s),
                _ => unimplemented!(),
            })
            .collect();

        if !children.is_empty() {
            let children_list_expr = if children.len() == 1 {
                children.remove(0)
            }
            else {
                Box::new(self.build_children_array(children))
                // Box::new(Expr::Array(swc_core::ecma::ast::ArrayLit {
                //     span: Span::dummy(),
                //     elems: children.into_iter().map(ExprOrSpread::from).map(Some).collect(),
                // }))
            };

            if self.expr_needs_wrapping(&children_list_expr) {
                props.push(PropOrSpread::Prop(Box::new(Prop::Getter(swc_core::ecma::ast::GetterProp {
                    key: PropName::Str("children".into()),
                    body: Some(swc_core::ecma::ast::BlockStmt {
                        stmts: vec![Stmt::Return(swc_core::ecma::ast::ReturnStmt {
                            arg: Some(children_list_expr),
                            ..Default::default()
                        })],
                        ..Default::default()
                    }),
                    ..Default::default()
                }))));
            }
            else {
                props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp { key: PropName::Str("children".into()), value: children_list_expr }))));
            }
        }

        Expr::Object(ObjectLit { span, props })
    }

    fn build_children_array(&mut self, children: Vec<Box<Expr>>) -> Expr {
        let mut current = Expr::New(swc_core::ecma::ast::NewExpr {
            callee: Box::new(Expr::Ident(self.get_lentjs_ident(CHILDREN_ARRAY_NAME))),
            ..Default::default()
        });

        for child in children {
            let must_wrap = self.expr_needs_wrapping(&child);
            current = Expr::Call(CallExpr {
                callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                    obj: Box::new(current),
                    prop: MemberProp::Ident(if must_wrap { "computed".into() } else { "child".into() }),
                    ..Default::default()
                }))),
                args: std::iter::once(ExprOrSpread {
                    spread: None,
                    expr: if must_wrap { Box::new(self.wrap_in_arrow_fn(*child)) } else { child },
                }).collect(),
                ..Default::default()
            });
        }

        current
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

    fn expr_needs_wrapping(&mut self, expr: &Expr) -> bool {
        let mut e = ExpressionNeedsWrapping {
            filter_list: self.idents.values().cloned().map(Into::into).collect(),
            found_dynamic: false,
        };
        expr.visit_with(&mut e);
        e.found_dynamic
    }

    fn wrap_in_arrow_fn(&mut self, expr: Expr) -> Expr {
        Expr::Arrow(swc_core::ecma::ast::ArrowExpr {
            body: Box::new(swc_core::ecma::ast::BlockStmtOrExpr::Expr(Box::new(expr))),
            ..Default::default()
        })
    }
}
