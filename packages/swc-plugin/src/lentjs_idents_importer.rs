use swc_core::{alloc::api::hashbrown::HashMap, atoms::Atom, common::{Span, util::take::Take as _}, ecma::ast::{Id, Ident, ImportDecl, ImportNamedSpecifier, ImportSpecifier, Module, ModuleDecl, ModuleItem, Str}};

const IMPORT_SOURCE: &str = "@lentjs/core";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LentjsIdent {
    Factory,
    Fragment,
    ChildrenArray,
    DefineAsProps,
    Register,
}

impl LentjsIdent {
    pub fn as_str(self) -> &'static str {
        match self {
            LentjsIdent::Factory => "factory",
            LentjsIdent::Fragment => "Fragment",
            LentjsIdent::ChildrenArray => "ChildrenArray",
            LentjsIdent::DefineAsProps => "defineAsProps",
            LentjsIdent::Register => "register",
        }
    }
}

#[derive(Default)]
pub struct LentjsIdentsImporter {
    idents: HashMap<LentjsIdent, Ident>,
}

impl LentjsIdentsImporter {
    pub fn is_ident(&self, id: &Id) -> bool {
        self.idents.values().any(|p| &Id::from(p.clone()) == id)
    }

    pub fn idents(&self) -> impl Iterator<Item = (LentjsIdent, &Ident)> {
        self.idents.iter()
            .map(|(&name, ident)| (name, ident))
    }

    pub fn get(&mut self, name: LentjsIdent) -> Ident {
        self.idents.entry(name)
            .or_insert_with(|| Ident::new_private(Atom::new(name.as_str()), Span::dummy()))
            .clone()
    }

    pub fn insert_import_decl(self, module: &mut Module) {
        let mut specifiers = Vec::new();
        for (name, ident) in self.idents {
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
}
