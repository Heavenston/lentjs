use std::collections::HashSet;

///! Code in this module is largely AI-Generated but with a few tweaks

use swc_core::{atoms::Wtf8Atom, common::{ Span, SyntaxContext, util::take::Take }, ecma::{
    ast::{Bool, CallExpr, Callee, Expr, ExprOrSpread, Id, Ident, JSXAttrName, JSXAttrOrSpread, JSXAttrValue, JSXElement, JSXElementChild, JSXElementName, JSXExpr, JSXFragment, JSXMemberExpr, JSXObject, KeyValueProp, Lit, MemberExpr, MemberProp, ObjectLit, Prop, PropName, PropOrSpread, SpreadElement, Str},
    visit::{ Visit, VisitMut, VisitMutWith, VisitWith },
}};

use crate::{jsx_whitespace::collapse_jsx_whitespace, lentjs_idents_importer::{LentjsIdent, LentjsIdentsImporter}};

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

pub struct JsxTransform<'a> {
    importer: &'a mut LentjsIdentsImporter,
}

impl VisitMut for JsxTransform<'_> {
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

impl<'a> JsxTransform<'a> {
    pub fn new(importer: &'a mut LentjsIdentsImporter) -> Self {
        Self {
            importer,
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
        let tag = Expr::Ident(self.importer.get(LentjsIdent::Fragment));
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
            callee: Callee::Expr(Box::new(Expr::Ident(self.importer.get(LentjsIdent::Factory)))),
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
        enum MyProp {
            Simple(PropName, Expr),
            Spread(SpreadElement),
        }

        let children_prop = if children.is_empty() {
            None
        } else {
            let e = if children.len() == 1 {
                *children.remove(0)
            }
            else {
                self.build_children_array(children)
            };
            Some(MyProp::Simple(PropName::Ident("children".into()), e))
        };
        let (getter_props, simple_props) = attrs
            .into_iter()
            .map(|attr| -> MyProp {match attr {
                JSXAttrOrSpread::JSXAttr(a) => {
                    let key = match a.name {
                        JSXAttrName::Ident(id) => PropName::Ident(id),
                        JSXAttrName::JSXNamespacedName(p) => PropName::Str(Str { span: p.span, value: Wtf8Atom::new(format!("{}:{}", p.ns.sym, p.name.sym)), raw: None }),
                        _ => unimplemented!(),
                    };
                    let value = self.jsx_attr_value_to_expr(a.value);
                    MyProp::Simple(key, value)
                }
                JSXAttrOrSpread::SpreadElement(s) => MyProp::Spread(s),
                _ => unimplemented!(),
            }})
            .chain(std::iter::once(children_prop).filter_map(std::convert::identity))
            .collect::<Vec<_>>().into_iter()
            .partition::<Vec<_>, _>(|p| match p { MyProp::Simple(_, e) => self.expr_needs_wrapping(e), _ => false });

        let base_obj = ObjectLit {
            span,
            props: simple_props.into_iter()
                .map(|e| match e {
                    MyProp::Simple(key, value) => PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                        key, value: Box::new(value),
                    }))),
                    MyProp::Spread(spread) => PropOrSpread::Spread(spread),
                })
                .collect(),
        };

        if getter_props.is_empty() {
            return Expr::from(base_obj);
        }
        
        let descriptors_obj = ObjectLit {
            span,
            props: getter_props.into_iter()
                .map(|e| match e { MyProp::Simple(key, val) => (key, val), _ => unreachable!() })
                .map(|(key, val)| {
                    PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                        key,
                        value: Box::new(ObjectLit {
                            props: vec![
                                Prop::KeyValue(KeyValueProp {
                                    key: PropName::Ident("get".into()),
                                    value: Box::new(self.wrap_in_arrow_fn(val)),
                                }).into(),
                                Prop::KeyValue(KeyValueProp {
                                    key: PropName::Ident("enumerable".into()),
                                    value: Box::new(Expr::Lit(Lit::Bool(true.into()))),
                                }).into(),
                            ],
                            ..Default::default()
                        }.into()),
                    })))
                })
                .collect(),
        };
        let final_obj_expr = Expr::Call(CallExpr {
            span,
            args: vec![ExprOrSpread::from(Expr::from(base_obj)), ExprOrSpread::from(Expr::from(descriptors_obj))],
            callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                span,
                // TODO: Object may be redefined, how to access the global Object(?)
                obj: Box::new(Expr::Ident(Ident::new("Object".into(), Span::dummy(), SyntaxContext::from_u32(1)))),
                prop: MemberProp::Ident("defineProperties".into()),
            }))),
            ..Default::default()
        });

        Expr::Call(CallExpr {
            span,
            args: vec![ExprOrSpread::from(Expr::from(final_obj_expr))],
            callee: Callee::Expr(Box::new(Expr::from(self.importer.get(LentjsIdent::DefineAsProps)))),
            ..Default::default()
        })
    }

    fn build_children_array(&mut self, children: Vec<Box<Expr>>) -> Expr {
        let mut current = Expr::New(swc_core::ecma::ast::NewExpr {
            callee: Box::new(Expr::Ident(self.importer.get(LentjsIdent::ChildrenArray))),
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
            filter_list: self.importer.idents()
                .filter(|&(k, _)| k != LentjsIdent::Factory)
                .map(|(_, v)| v)
                .cloned()
                .map(Into::into)
                .collect(),
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
