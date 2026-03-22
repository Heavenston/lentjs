
export declare namespace Lent {
  type ClassList = null | undefined | string | Partial<Record<string, boolean>> | ClassList[];
  type Booleanish = boolean | 'true' | 'false';

  type JSXNode = HTMLElement;
  type JSXOutput = JSXNode | string | number | boolean | null | undefined | JSXOutput[];
  type JSXChildren =
    | string
    | number
    | boolean
    | null
    | undefined
    | JSXChildren[]
    | JSXNode;

  export interface IComponent<P> {
    props: Readonly<P>,
    render(): JSXOutput;
  }

  // export type FnComponent<P> = (props: P) => JSXOutput;
  export type Component<P> = IComponent<P>;

  // All the WAI-ARIA 1.1 attributes from https://www.w3.org/TR/wai-aria-1.1/
  interface AriaAttributes {
    /** Identifies the currently active element when DOM focus is on a composite widget, textbox, group, or application. */
    'aria-activedescendant'?: string | null | undefined;
    /** Indicates whether assistive technologies will present all, or only parts of, the changed region based on the change notifications defined by the aria-relevant attribute. */
    'aria-atomic'?: Booleanish | null | undefined;
    /**
     * Indicates whether inputting text could trigger display of one or more predictions of the user's intended value for an input and specifies how predictions would be
     * presented if they are made.
     */
    'aria-autocomplete'?:
      | 'none'
      | 'inline'
      | 'list'
      | 'both'
      | null
      | undefined;
    /** Indicates an element is being modified and that assistive technologies MAY want to wait until the modifications are complete before exposing them to the user. */
    /**
     * Defines a string value that labels the current element, which is intended to be converted into Braille.
     * @see aria-label.
     */
    'aria-braillelabel'?: string | null | undefined;
    /**
     * Defines a human-readable, author-localized abbreviated description for the role of an element, which is intended to be converted into Braille.
     * @see aria-roledescription.
     */
    'aria-brailleroledescription'?: string | null | undefined;
    'aria-busy'?: Booleanish | null | undefined;
    /**
     * Indicates the current "checked" state of checkboxes, radio buttons, and other widgets.
     * @see aria-pressed @see aria-selected.
     */
    'aria-checked'?: boolean | 'false' | 'mixed' | 'true' | null | undefined;
    /**
     * Defines the total number of columns in a table, grid, or treegrid.
     * @see aria-colindex.
     */
    'aria-colcount'?: number | null | undefined;
    /**
     * Defines an element's column index or position with respect to the total number of columns within a table, grid, or treegrid.
     * @see aria-colcount @see aria-colspan.
     */
    'aria-colindex'?: number | null | undefined;
    /**
     * Defines a human readable text alternative of aria-colindex.
     * @see aria-rowindextext.
     */
    'aria-colindextext'?: string | null | undefined;
    /**
     * Defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid.
     * @see aria-colindex @see aria-rowspan.
     */
    'aria-colspan'?: number | null | undefined;
    /**
     * Identifies the element (or elements) whose contents or presence are controlled by the current element.
     * @see aria-owns.
     */
    'aria-controls'?: string | null | undefined;
    /** Indicates the element that represents the current item within a container or set of related elements. */
    'aria-current'?:
      | boolean
      | 'false'
      | 'true'
      | 'page'
      | 'step'
      | 'location'
      | 'date'
      | 'time'
      | null
      | undefined;
    /**
     * Identifies the element (or elements) that describes the object.
     * @see aria-labelledby
     */
    'aria-describedby'?: string | null | undefined;
    /**
     * Defines a string value that describes or annotates the current element.
     * @see related aria-describedby.
     */
    'aria-description'?: string | null | undefined;
    /**
     * Identifies the element that provides a detailed, extended description for the object.
     * @see aria-describedby.
     */
    'aria-details'?: string | null | undefined;
    /**
     * Indicates that the element is perceivable but disabled, so it is not editable or otherwise operable.
     * @see aria-hidden @see aria-readonly.
     */
    'aria-disabled'?: Booleanish | null | undefined;
    /**
     * Indicates what functions can be performed when a dragged object is released on the drop target.
     * @deprecated in ARIA 1.1
     */
    'aria-dropeffect'?:
      | 'none'
      | 'copy'
      | 'execute'
      | 'link'
      | 'move'
      | 'popup'
      | null
      | undefined;
    /**
     * Identifies the element that provides an error message for the object.
     * @see aria-invalid @see aria-describedby.
     */
    'aria-errormessage'?: string | null | undefined;
    /** Indicates whether the element, or another grouping element it controls, is currently expanded or collapsed. */
    'aria-expanded'?: Booleanish | null | undefined;
    /**
     * Identifies the next element (or elements) in an alternate reading order of content which, at the user's discretion,
     * allows assistive technology to override the general default of reading in document source order.
     */
    'aria-flowto'?: string | null | undefined;
    /**
     * Indicates an element's "grabbed" state in a drag-and-drop operation.
     * @deprecated in ARIA 1.1
     */
    'aria-grabbed'?: Booleanish | null | undefined;
    /** Indicates the availability and type of interactive popup element, such as menu or dialog, that can be triggered by an element. */
    'aria-haspopup'?:
      | boolean
      | 'false'
      | 'true'
      | 'menu'
      | 'listbox'
      | 'tree'
      | 'grid'
      | 'dialog'
      | null
      | undefined;
    /**
     * Indicates whether the element is exposed to an accessibility API.
     * @see aria-disabled.
     */
    'aria-hidden'?: Booleanish | null | undefined;
    /**
     * Indicates the entered value does not conform to the format expected by the application.
     * @see aria-errormessage.
     */
    'aria-invalid'?:
      | boolean
      | 'false'
      | 'true'
      | 'grammar'
      | 'spelling'
      | null
      | undefined;
    /** Indicates keyboard shortcuts that an author has implemented to activate or give focus to an element. */
    'aria-keyshortcuts'?: string | null | undefined;
    /**
     * Defines a string value that labels the current element.
     * @see aria-labelledby.
     */
    'aria-label'?: string | null | undefined;
    /**
     * Identifies the element (or elements) that labels the current element.
     * @see aria-describedby.
     */
    'aria-labelledby'?: string | null | undefined;
    /** Defines the hierarchical level of an element within a structure. */
    'aria-level'?: number | null | undefined;
    /** Indicates that an element will be updated, and describes the types of updates the user agents, assistive technologies, and user can expect from the live region. */
    'aria-live'?: 'off' | 'assertive' | 'polite' | null | undefined;
    /** Indicates whether an element is modal when displayed. */
    'aria-modal'?: Booleanish | null | undefined;
    /** Indicates whether a text box accepts multiple lines of input or only a single line. */
    'aria-multiline'?: Booleanish | null | undefined;
    /** Indicates that the user may select more than one item from the current selectable descendants. */
    'aria-multiselectable'?: Booleanish | null | undefined;
    /** Indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous. */
    'aria-orientation'?: 'horizontal' | 'vertical' | null | undefined;
    /**
     * Identifies an element (or elements) in order to define a visual, functional, or contextual parent/child relationship
     * between DOM elements where the DOM hierarchy cannot be used to represent the relationship.
     * @see aria-controls.
     */
    'aria-owns'?: string | null | undefined;
    /**
     * Defines a short hint (a word or short phrase) intended to aid the user with data entry when the control has no value.
     * A hint could be a sample value or a brief description of the expected format.
     */
    'aria-placeholder'?: string | null | undefined;
    /**
     * Defines an element's number or position in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
     * @see aria-setsize.
     */
    'aria-posinset'?: number | null | undefined;
    /**
     * Indicates the current "pressed" state of toggle buttons.
     * @see aria-checked @see aria-selected.
     */
    'aria-pressed'?: boolean | 'false' | 'mixed' | 'true' | null | undefined;
    /**
     * Indicates that the element is not editable, but is otherwise operable.
     * @see aria-disabled.
     */
    'aria-readonly'?: Booleanish | null | undefined;
    /**
     * Indicates what notifications the user agent will trigger when the accessibility tree within a live region is modified.
     * @see aria-atomic.
     */
    'aria-relevant'?:
      | 'additions'
      | 'additions removals'
      | 'additions text'
      | 'all'
      | 'removals'
      | 'removals additions'
      | 'removals text'
      | 'text'
      | 'text additions'
      | 'text removals'
      | null
      | undefined;
    /** Indicates that user input is required on the element before a form may be submitted. */
    'aria-required'?: Booleanish | null | undefined;
    /** Defines a human-readable, author-localized description for the role of an element. */
    'aria-roledescription'?: string | null | undefined;
    /**
     * Defines the total number of rows in a table, grid, or treegrid.
     * @see aria-rowindex.
     */
    'aria-rowcount'?: number | null | undefined;
    /**
     * Defines an element's row index or position with respect to the total number of rows within a table, grid, or treegrid.
     * @see aria-rowcount @see aria-rowspan.
     */
    'aria-rowindex'?: number | null | undefined;
    /**
     * Defines a human readable text alternative of aria-rowindex.
     * @see aria-colindextext.
     */
    'aria-rowindextext'?: string | null | undefined;
    /**
     * Defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid.
     * @see aria-rowindex @see aria-colspan.
     */
    'aria-rowspan'?: number | null | undefined;
    /**
     * Indicates the current "selected" state of various widgets.
     * @see aria-checked @see aria-pressed.
     */
    'aria-selected'?: Booleanish | null | undefined;
    /**
     * Defines the number of items in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
     * @see aria-posinset.
     */
    'aria-setsize'?: number | null | undefined;
    /** Indicates if items in a table or grid are sorted in ascending or descending order. */
    'aria-sort'?:
      | 'none'
      | 'ascending'
      | 'descending'
      | 'other'
      | null
      | undefined;
    /** Defines the maximum allowed value for a range widget. */
    'aria-valuemax'?: number | null | undefined;
    /** Defines the minimum allowed value for a range widget. */
    'aria-valuemin'?: number | null | undefined;
    /**
     * Defines the current value for a range widget.
     * @see aria-valuetext.
     */
    'aria-valuenow'?: number | null | undefined;
    /** Defines the human readable text alternative of aria-valuenow for a range widget. */
    'aria-valuetext'?: string | null | undefined;
  }

  interface DOMAttributes<T> {
    children?: JSXChildren;
    dangerouslySetInnerHTML?:
      | {
          __html: string;
        }
      | null
      | undefined;

    // Clipboard Events
    onCopy?: ClipboardEventHandler<T> | undefined;
    onCut?: ClipboardEventHandler<T> | undefined;
    onPaste?: ClipboardEventHandler<T> | undefined;

    // Composition Events
    onCompositionEnd?: CompositionEventHandler<T> | undefined;
    onCompositionStart?: CompositionEventHandler<T> | undefined;
    onCompositionUpdate?: CompositionEventHandler<T> | undefined;

    // Focus Events
    onFocus?: FocusEventHandler<T> | undefined;
    onBlur?: FocusEventHandler<T> | undefined;

    // Form Events
    onChange?: FormEventHandler<T> | undefined | null;
    onBeforeInput?: FormEventHandler<T> | undefined;
    onInput?: FormEventHandler<T> | undefined;
    onReset?: FormEventHandler<T> | undefined;
    onSubmit?: FormEventHandler<T> | undefined;
    onInvalid?: FormEventHandler<T> | undefined;

    // Image Events
    onLoad?: InfernoEventHandler<T> | undefined;
    onError?: InfernoEventHandler<T> | undefined; // also a Media Event

    // Keyboard Events
    onKeyDown?: KeyboardEventHandler<T> | undefined;
    onKeyPress?: KeyboardEventHandler<T> | undefined;
    onKeyUp?: KeyboardEventHandler<T> | undefined;

    // Media Events
    onAbort?: InfernoEventHandler<T> | undefined;
    onCanPlay?: InfernoEventHandler<T> | undefined;
    onCanPlayThrough?: InfernoEventHandler<T> | undefined;
    onDurationChange?: InfernoEventHandler<T> | undefined;
    onEmptied?: InfernoEventHandler<T> | undefined;
    onEncrypted?: InfernoEventHandler<T> | undefined;
    onEnded?: InfernoEventHandler<T> | undefined;
    onLoadedData?: InfernoEventHandler<T> | undefined;
    onLoadedMetadata?: InfernoEventHandler<T> | undefined;
    onLoadStart?: InfernoEventHandler<T> | undefined;
    onPause?: InfernoEventHandler<T> | undefined;
    onPlay?: InfernoEventHandler<T> | undefined;
    onPlaying?: InfernoEventHandler<T> | undefined;
    onProgress?: InfernoEventHandler<T> | undefined;
    onRateChange?: InfernoEventHandler<T> | undefined;
    onSeeked?: InfernoEventHandler<T> | undefined;
    onSeeking?: InfernoEventHandler<T> | undefined;
    onStalled?: InfernoEventHandler<T> | undefined;
    onSuspend?: InfernoEventHandler<T> | undefined;
    onTimeUpdate?: InfernoEventHandler<T> | undefined;
    onVolumeChange?: InfernoEventHandler<T> | undefined;
    onWaiting?: InfernoEventHandler<T> | undefined;

    // MouseEvents
    onAuxClick?: MouseEventHandler<T> | undefined;
    onClick?: MouseEventHandler<T> | undefined;
    onContextMenu?: MouseEventHandler<T> | undefined;
    onDblClick?: MouseEventHandler<T> | undefined;
    onDrag?: DragEventHandler<T> | undefined;
    onDragEnd?: DragEventHandler<T> | undefined;
    onDragEnter?: DragEventHandler<T> | undefined;
    onDragExit?: DragEventHandler<T> | undefined;
    onDragLeave?: DragEventHandler<T> | undefined;
    onDragOver?: DragEventHandler<T> | undefined;
    onDragStart?: DragEventHandler<T> | undefined;
    onDrop?: DragEventHandler<T> | undefined;
    onMouseDown?: MouseEventHandler<T> | undefined;
    onMouseEnter?: MouseEventHandler<T> | undefined;
    onMouseLeave?: MouseEventHandler<T> | undefined;
    onMouseMove?: MouseEventHandler<T> | undefined;
    onMouseOut?: MouseEventHandler<T> | undefined;
    onMouseOver?: MouseEventHandler<T> | undefined;
    onMouseUp?: MouseEventHandler<T> | undefined;

    // Selection Events
    onSelect?: InfernoEventHandler<T> | undefined;

    // Touch Events
    onTouchCancel?: TouchEventHandler<T> | undefined;
    onTouchEnd?: TouchEventHandler<T> | undefined;
    onTouchMove?: TouchEventHandler<T> | undefined;
    onTouchStart?: TouchEventHandler<T> | undefined;

    // Pointer Events
    onPointerDown?: PointerEventHandler<T> | undefined;
    onPointerMove?: PointerEventHandler<T> | undefined;
    onPointerUp?: PointerEventHandler<T> | undefined;
    onPointerCancel?: PointerEventHandler<T> | undefined;
    onPointerEnter?: PointerEventHandler<T> | undefined;
    onPointerLeave?: PointerEventHandler<T> | undefined;
    onPointerOver?: PointerEventHandler<T> | undefined;
    onPointerOut?: PointerEventHandler<T> | undefined;

    // UI Events
    onScroll?: UIEventHandler<T> | undefined;

    // Wheel Events
    onWheel?: WheelEventHandler<T> | undefined;

    // Animation Events
    onAnimationStart?: AnimationEventHandler<T> | undefined;
    onAnimationEnd?: AnimationEventHandler<T> | undefined;
    onAnimationIteration?: AnimationEventHandler<T> | undefined;

    // Transition Events
    onTransitionEnd?: TransitionEventHandler<T> | undefined;
  }

  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    // Lent-specific Attributes
    class?: ClassList | null | undefined;
    defaultChecked?: boolean | null | undefined;
    defaultValue?: string | number | readonly string[] | null | undefined;

    // Standard HTML Attributes
    accessKey?: string | null | undefined;
    autoCapitalize?:
      | 'off'
      | 'none'
      | 'on'
      | 'sentences'
      | 'words'
      | 'characters'
      | null
      | undefined
      | (string & {});
    autoFocus?: boolean | null | undefined;
    className?: string | null | undefined;
    contentEditable?:
      | Booleanish
      | 'inherit'
      | 'plaintext-only'
      | null
      | undefined;
    contextMenu?: string | null | undefined;
    dir?: string | null | undefined;
    draggable?: Booleanish | null | undefined;
    enterKeyHint?:
      | 'enter'
      | 'done'
      | 'go'
      | 'next'
      | 'previous'
      | 'search'
      | 'send'
      | null
      | undefined;
    hidden?: boolean | null | undefined;
    id?: string | null | undefined;
    lang?: string | null | undefined;
    nonce?: string | null | undefined;
    slot?: string | null | undefined;
    spellCheck?: Booleanish | null | undefined;
    style?: PropertiesHyphen | string | null | undefined | CssVariables;
    tabIndex?: number | null | undefined;
    title?: string | null | undefined;
    translate?: 'yes' | 'no' | null | undefined;

    // Unknown
    radioGroup?: string | null | undefined; // <command>, <menuitem>

    // WAI-ARIA
    role?: AriaRole | null | undefined;

    // RDFa Attributes
    about?: string | null | undefined;
    content?: string | null | undefined;
    datatype?: string | null | undefined;
    inlist?: any;
    prefix?: string | null | undefined;
    property?: string | null | undefined;
    rel?: string | null | undefined;
    resource?: string | null | undefined;
    rev?: string | null | undefined;
    typeof?: string | null | undefined;
    vocab?: string | null | undefined;

    // Non-standard Attributes
    autoCorrect?: string | null | undefined;
    autoSave?: string | null | undefined;
    color?: string | null | undefined;
    itemProp?: string | null | undefined;
    itemScope?: boolean | null | undefined;
    itemType?: string | null | undefined;
    itemID?: string | null | undefined;
    itemRef?: string | null | undefined;
    results?: number | null | undefined;
    security?: string | null | undefined;
    unselectable?: 'on' | 'off' | null | undefined;

    // Living Standard
    /**
     * Hints at the type of data that might be entered by the user while editing the element or its contents
     * @see {@link https://html.spec.whatwg.org/multipage/interaction.html#input-modalities:-the-inputmode-attribute}
     */
    inputMode?:
      | 'none'
      | 'text'
      | 'tel'
      | 'url'
      | 'email'
      | 'numeric'
      | 'decimal'
      | 'search'
      | null
      | undefined;
    /**
     * Specify that a standard HTML element should behave like a defined custom built-in element
     * @see {@link https://html.spec.whatwg.org/multipage/custom-elements.html#attr-is}
     */
    is?: string | null | undefined;
  }

  type DetailedHTMLProps<E extends HTMLAttributes<T>, T> = {
    
  } & E;
}

declare global {
  export namespace JSX {
    interface ElementAttributesProperty {
      props: {};
    }

    type Element = HTMLElement;
    type ClassList = string;

    // export interface IntrinsicAttributes {
    //   children?: JSXChildren;
    // }

    interface IntrinsicElements {
      // HTML
      a: Lent.DetailedHTMLProps<
        Lent.AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >;
      abbr: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      address: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      area: Lent.DetailedHTMLProps<
        Lent.AreaHTMLAttributes<HTMLAreaElement>,
        HTMLAreaElement
      >;
      article: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      aside: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      audio: Lent.DetailedHTMLProps<
        Lent.AudioHTMLAttributes<HTMLAudioElement>,
        HTMLAudioElement
      >;
      b: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      base: Lent.DetailedHTMLProps<
        Lent.BaseHTMLAttributes<HTMLBaseElement>,
        HTMLBaseElement
      >;
      bdi: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      bdo: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      big: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      blockquote: Lent.DetailedHTMLProps<
        Lent.BlockquoteHTMLAttributes<HTMLQuoteElement>,
        HTMLQuoteElement
      >;
      body: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLBodyElement>,
        HTMLBodyElement
      >;
      br: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLBRElement>,
        HTMLBRElement
      >;
      button: Lent.DetailedHTMLProps<
        Lent.ButtonHTMLAttributes<HTMLButtonElement>,
        HTMLButtonElement
      >;
      canvas: Lent.DetailedHTMLProps<
        Lent.CanvasHTMLAttributes<HTMLCanvasElement>,
        HTMLCanvasElement
      >;
      caption: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      cite: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      code: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      col: Lent.DetailedHTMLProps<
        Lent.ColHTMLAttributes<HTMLTableColElement>,
        HTMLTableColElement
      >;
      colgroup: Lent.DetailedHTMLProps<
        Lent.ColgroupHTMLAttributes<HTMLTableColElement>,
        HTMLTableColElement
      >;
      data: Lent.DetailedHTMLProps<
        Lent.DataHTMLAttributes<HTMLDataElement>,
        HTMLDataElement
      >;
      datalist: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLDataListElement>,
        HTMLDataListElement
      >;
      dd: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      del: Lent.DetailedHTMLProps<
        Lent.DelHTMLAttributes<HTMLModElement>,
        HTMLModElement
      >;
      details: Lent.DetailedHTMLProps<
        Lent.DetailsHTMLAttributes<HTMLDetailsElement>,
        HTMLDetailsElement
      >;
      dfn: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      dialog: Lent.DetailedHTMLProps<
        Lent.DialogHTMLAttributes<HTMLDialogElement>,
        HTMLDialogElement
      >;
      div: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLDivElement>,
        HTMLDivElement
      >;
      dl: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLDListElement>,
        HTMLDListElement
      >;
      dt: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      em: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      embed: Lent.DetailedHTMLProps<
        Lent.EmbedHTMLAttributes<HTMLEmbedElement>,
        HTMLEmbedElement
      >;
      fieldset: Lent.DetailedHTMLProps<
        Lent.FieldsetHTMLAttributes<HTMLFieldSetElement>,
        HTMLFieldSetElement
      >;
      figcaption: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      figure: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      footer: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      form: Lent.DetailedHTMLProps<
        Lent.FormHTMLAttributes<HTMLFormElement>,
        HTMLFormElement
      >;
      h1: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      h2: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      h3: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      h4: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      h5: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      h6: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      head: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLHeadElement>,
        HTMLHeadElement
      >;
      header: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      hgroup: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      hr: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLHRElement>,
        HTMLHRElement
      >;
      html: Lent.DetailedHTMLProps<
        Lent.HtmlHTMLAttributes<HTMLHtmlElement>,
        HTMLHtmlElement
      >;
      i: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      iframe: Lent.DetailedHTMLProps<
        Lent.IframeHTMLAttributes<HTMLIFrameElement>,
        HTMLIFrameElement
      >;
      img: Lent.DetailedHTMLProps<
        Lent.ImgHTMLAttributes<HTMLImageElement>,
        HTMLImageElement
      >;
      input: Lent.DetailedHTMLProps<
        Lent.InputHTMLAttributes<HTMLInputElement>,
        HTMLInputElement
      >;
      ins: Lent.DetailedHTMLProps<
        Lent.InsHTMLAttributes<HTMLModElement>,
        HTMLModElement
      >;
      kbd: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      keygen: Lent.DetailedHTMLProps<
        Lent.KeygenHTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      label: Lent.DetailedHTMLProps<
        Lent.LabelHTMLAttributes<HTMLLabelElement>,
        HTMLLabelElement
      >;
      legend: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLLegendElement>,
        HTMLLegendElement
      >;
      li: Lent.DetailedHTMLProps<
        Lent.LiHTMLAttributes<HTMLLIElement>,
        HTMLLIElement
      >;
      link: Lent.DetailedHTMLProps<
        Lent.LinkHTMLAttributes<HTMLLinkElement>,
        HTMLLinkElement
      >;
      main: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      map: Lent.DetailedHTMLProps<
        Lent.MapHTMLAttributes<HTMLMapElement>,
        HTMLMapElement
      >;
      mark: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      media: Lent.DetailedHTMLProps<
        Lent.MediaHTMLAttributes<HTMLMediaElement>,
        HTMLMediaElement
      >;
      menu: Lent.DetailedHTMLProps<
        Lent.MenuHTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      menuitem: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      meta: Lent.DetailedHTMLProps<
        Lent.MetaHTMLAttributes<HTMLMetaElement>,
        HTMLMetaElement
      >;
      meter: Lent.DetailedHTMLProps<
        Lent.MeterHTMLAttributes<HTMLMeterElement>,
        HTMLMeterElement
      >;
      nav: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      noindex: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      noscript: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      object: Lent.DetailedHTMLProps<
        Lent.ObjectHTMLAttributes<HTMLObjectElement>,
        HTMLObjectElement
      >;
      ol: Lent.DetailedHTMLProps<
        Lent.OlHTMLAttributes<HTMLOListElement>,
        HTMLOListElement
      >;
      optgroup: Lent.DetailedHTMLProps<
        Lent.OptgroupHTMLAttributes<HTMLOptGroupElement>,
        HTMLOptGroupElement
      >;
      option: Lent.DetailedHTMLProps<
        Lent.OptionHTMLAttributes<HTMLOptionElement>,
        HTMLOptionElement
      >;
      output: Lent.DetailedHTMLProps<
        Lent.OutputHTMLAttributes<HTMLOutputElement>,
        HTMLOutputElement
      >;
      p: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLParagraphElement>,
        HTMLParagraphElement
      >;
      param: Lent.DetailedHTMLProps<
        Lent.ParamHTMLAttributes<HTMLParamElement>,
        HTMLParamElement
      >;
      picture: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      pre: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLPreElement>,
        HTMLPreElement
      >;
      progress: Lent.DetailedHTMLProps<
        Lent.ProgressHTMLAttributes<HTMLProgressElement>,
        HTMLProgressElement
      >;
      q: Lent.DetailedHTMLProps<
        Lent.QuoteHTMLAttributes<HTMLQuoteElement>,
        HTMLQuoteElement
      >;
      rp: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      rt: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      ruby: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      s: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      samp: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      slot: Lent.DetailedHTMLProps<
        Lent.SlotHTMLAttributes<HTMLSlotElement>,
        HTMLSlotElement
      >;
      script: Lent.DetailedHTMLProps<
        Lent.ScriptHTMLAttributes<HTMLScriptElement>,
        HTMLScriptElement
      >;
      section: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      select: Lent.DetailedHTMLProps<
        Lent.SelectHTMLAttributes<HTMLSelectElement>,
        HTMLSelectElement
      >;
      small: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      source: Lent.DetailedHTMLProps<
        Lent.SourceHTMLAttributes<HTMLSourceElement>,
        HTMLSourceElement
      >;
      span: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLSpanElement>,
        HTMLSpanElement
      >;
      strong: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      style: Lent.DetailedHTMLProps<
        Lent.StyleHTMLAttributes<HTMLStyleElement>,
        HTMLStyleElement
      >;
      sub: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      summary: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      sup: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      table: Lent.DetailedHTMLProps<
        Lent.TableHTMLAttributes<HTMLTableElement>,
        HTMLTableElement
      >;
      template: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLTemplateElement>,
        HTMLTemplateElement
      >;
      tbody: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLTableSectionElement>,
        HTMLTableSectionElement
      >;
      td: Lent.DetailedHTMLProps<
        Lent.TdHTMLAttributes<HTMLTableDataCellElement>,
        HTMLTableDataCellElement
      >;
      textarea: Lent.DetailedHTMLProps<
        Lent.TextareaHTMLAttributes<HTMLTextAreaElement>,
        HTMLTextAreaElement
      >;
      tfoot: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLTableSectionElement>,
        HTMLTableSectionElement
      >;
      th: Lent.DetailedHTMLProps<
        Lent.ThHTMLAttributes<HTMLTableHeaderCellElement>,
        HTMLTableHeaderCellElement
      >;
      thead: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLTableSectionElement>,
        HTMLTableSectionElement
      >;
      time: Lent.DetailedHTMLProps<
        Lent.TimeHTMLAttributes<HTMLTimeElement>,
        HTMLTimeElement
      >;
      title: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLTitleElement>,
        HTMLTitleElement
      >;
      tr: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLTableRowElement>,
        HTMLTableRowElement
      >;
      track: Lent.DetailedHTMLProps<
        Lent.TrackHTMLAttributes<HTMLTrackElement>,
        HTMLTrackElement
      >;
      u: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      ul: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLUListElement>,
        HTMLUListElement
      >;
      var: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      video: Lent.DetailedHTMLProps<
        Lent.VideoHTMLAttributes<HTMLVideoElement>,
        HTMLVideoElement
      >;
      wbr: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      // webview: Lent.DetailedHTMLProps<Lent.WebViewHTMLAttributes<HTMLWebViewElement>, HTMLWebViewElement>;

      // SVG
      svg: Lent.SVGProps<SVGSVGElement>;

      animate: Lent.SVGProps<SVGAnimateElement>;
      animateMotion: Lent.SVGProps<SVGElement>;
      animateTransform: Lent.SVGProps<SVGAnimateTransformElement>;
      circle: Lent.SVGProps<SVGCircleElement>;
      clipPath: Lent.SVGProps<SVGClipPathElement>;
      defs: Lent.SVGProps<SVGDefsElement>;
      desc: Lent.SVGProps<SVGDescElement>;
      ellipse: Lent.SVGProps<SVGEllipseElement>;
      feBlend: Lent.SVGProps<SVGFEBlendElement>;
      feColorMatrix: Lent.SVGProps<SVGFEColorMatrixElement>;
      feComponentTransfer: Lent.SVGProps<SVGFEComponentTransferElement>;
      feComposite: Lent.SVGProps<SVGFECompositeElement>;
      feConvolveMatrix: Lent.SVGProps<SVGFEConvolveMatrixElement>;
      feDiffuseLighting: Lent.SVGProps<SVGFEDiffuseLightingElement>;
      feDisplacementMap: Lent.SVGProps<SVGFEDisplacementMapElement>;
      feDistantLight: Lent.SVGProps<SVGFEDistantLightElement>;
      feDropShadow: Lent.SVGProps<SVGFEDropShadowElement>;
      feFlood: Lent.SVGProps<SVGFEFloodElement>;
      feFuncA: Lent.SVGProps<SVGFEFuncAElement>;
      feFuncB: Lent.SVGProps<SVGFEFuncBElement>;
      feFuncG: Lent.SVGProps<SVGFEFuncGElement>;
      feFuncR: Lent.SVGProps<SVGFEFuncRElement>;
      feGaussianBlur: Lent.SVGProps<SVGFEGaussianBlurElement>;
      feImage: Lent.SVGProps<SVGFEImageElement>;
      feMerge: Lent.SVGProps<SVGFEMergeElement>;
      feMergeNode: Lent.SVGProps<SVGFEMergeNodeElement>;
      feMorphology: Lent.SVGProps<SVGFEMorphologyElement>;
      feOffset: Lent.SVGProps<SVGFEOffsetElement>;
      fePointLight: Lent.SVGProps<SVGFEPointLightElement>;
      feSpecularLighting: Lent.SVGProps<SVGFESpecularLightingElement>;
      feSpotLight: Lent.SVGProps<SVGFESpotLightElement>;
      feTile: Lent.SVGProps<SVGFETileElement>;
      feTurbulence: Lent.SVGProps<SVGFETurbulenceElement>;
      filter: Lent.SVGProps<SVGFilterElement>;
      foreignObject: Lent.SVGProps<SVGForeignObjectElement>;
      g: Lent.SVGProps<SVGGElement>;
      image: Lent.SVGProps<SVGImageElement>;
      line: Lent.SVGProps<SVGLineElement>;
      linearGradient: Lent.SVGProps<SVGLinearGradientElement>;
      marker: Lent.SVGProps<SVGMarkerElement>;
      mask: Lent.SVGProps<SVGMaskElement>;
      metadata: Lent.SVGProps<SVGMetadataElement>;
      mpath: Lent.SVGProps<SVGElement>;
      path: Lent.SVGProps<SVGPathElement>;
      pattern: Lent.SVGProps<SVGPatternElement>;
      polygon: Lent.SVGProps<SVGPolygonElement>;
      polyline: Lent.SVGProps<SVGPolylineElement>;
      radialGradient: Lent.SVGProps<SVGRadialGradientElement>;
      rect: Lent.SVGProps<SVGRectElement>;
      stop: Lent.SVGProps<SVGStopElement>;
      switch: Lent.SVGProps<SVGSwitchElement>;
      symbol: Lent.SVGProps<SVGSymbolElement>;
      text: Lent.SVGProps<SVGTextElement>;
      textPath: Lent.SVGProps<SVGTextPathElement>;
      tspan: Lent.SVGProps<SVGTSpanElement>;
      use: Lent.SVGProps<SVGUseElement>;
      view: Lent.SVGProps<SVGViewElement>;

      // MathML
      maction: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      math: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      menclose: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      merror: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mfenced: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mfrac: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mi: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mmultiscripts: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mn: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mo: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mover: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mpadded: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mphantom: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mroot: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mrow: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      ms: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mspace: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      msqrt: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mstyle: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      msub: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      msubsup: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      msup: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mtable: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mtd: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mtext: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      mtr: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      munder: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      munderover: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
      semantics: Lent.DetailedHTMLProps<
        Lent.HTMLAttributes<MathMLElement>,
        MathMLElement
      >;
    }
  }
}
