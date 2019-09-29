import * as React from "react";
import {Player, Utils} from "ractive-player";

import Module from "@webu/module";

import "../loaders/codemirror";

import {inject, injectCSS} from "@webu/utils";
import {on, off} from "@webu/utils/events";
import {bind} from "@webu/utils/misc";

interface Props {
  keyMap?: any;
  mode?: string;
  readOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  theme?: string;
}

export default class PythonEditor extends React.Component<Props, {}> {
  static contextType = Player.Context;
  editor: CodeMirror.Editor;
  placeholder: HTMLDivElement;
  ready: Promise<void>;
  private setReady: Function;
  private player: Player;

  static defaultProps = {
    keyMap: {},
    mode: "python",
    readOnly: false,
    style: {},
    theme: "epiplexis"
  }

  constructor(props: Props, context: Player) {
    super(props, context);
    this.player = context;

    this.ready = new Promise((resolve, reject) => {
      this.setReady = resolve;
    });
  }
  
  async componentDidMount() {
    // codemirror bullshit
    const CodeMirror = await Module.import("codemirror");
    await CodeMirror.loadMode("python");

    const defaults = {
      indentUnit: 4,
      lineNumbers: true,
      mode: "python",
      tabSize: 4,
      theme: "epiplexis"
    };
    const options = Object.assign(defaults, whitelist(this.props, ["mode", "readOnly", "theme"]));
    this.editor = window.CodeMirror(
      (elt) => {
        this.placeholder.parentNode.replaceChild(elt, this.placeholder);
      },
      options
    );

    /* make available from DOM */
    this.editor.getInputField()[Symbol.for("PythonEditor")] = this;

    /* copy props */
    const wrapper = this.editor.getWrapperElement();
    Object.assign(wrapper.style, this.props.style);
    const classNames = this.props.className ? this.props.className.split(" ") : [];
    for (const className of classNames) {
      wrapper.classList.add(className);
    }

    /* event handlers */
    // avoid pausing video
    on(wrapper, "mouseup", e => e.stopPropagation());

    this.editor.on("keydown", (cm, e) => {
      if (!e.key.match(/^[A-Z]$/i)) return;
      
      cm.showHint({
        hint: CodeMirror.hint.anyword,
        completeSingle: false,
        customKeys: {
          "Cmd-/": (cm, handle) => handle.close(),
          Tab: (cm, handle) => handle.pick()
        }
      });
    });

    // avoid setting off keyboard controls
    this.editor.on("focus", () => {
      if (this.props.readOnly) return;

      this.player.suspendKeyCapture();
    });

    this.editor.on("blur", () => {
      if (this.props.readOnly) return;

      // XXX ugh fuck
      this.player.resumeKeyCapture();
    });

    /* keyboard shortcuts */
    const keyMap = Object.assign(
      {},
      {
        Tab(cm) {
          const spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
          cm.replaceSelection(spaces);
        }
      },
      this.props.keyMap
    );

    if (this.player.props.authoring) {
      for (const n of [2, 3, 4]) {
        keyMap[`Cmd-Alt-${n}`] = () => {
          this.player.resumeKeyCapture();

          document.body.dispatchEvent(new KeyboardEvent(
            "keydown",
            {code: `Digit${n}`, altKey: true, metaKey: true}
          ));

          this.player.suspendKeyCapture();
        };
      }
    }

    this.editor.addKeyMap(keyMap);

    this.setReady();
  }

  componentWillReceiveProps(nextProps) {
    if (!this.editor) return;
    const declaration = this.editor.getWrapperElement().style;

    for (const key in this.props.style) {
      if (!nextProps.hasOwnProperty(key)) {
        declaration.removeProperty(camel2dash(key));
      }
    }

    Object.assign(declaration, nextProps.style);
  }

  render() {
    return (
      <div ref={node => this.placeholder = node}/>
    );
  }
}

/* helper functions */
function camel2dash(str: string) {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function whitelist<T, K extends keyof T>(obj: T, keys: K[]) {
  return keys.map(k => k in obj ? {[k]: obj[k]} : {})
         .reduce((res, o) => Object.assign(res, o), {}) as Pick<T, K>;
}
