import * as React from "react";

import {Player} from "ractive-player";

import {Editor, Handle} from "codemirror";
import * as _ from "codemirror/addon/hint/show-hint";

interface Props {
  keyMap?: {
    [key: string]: () => unknown;
  };
  mode?: string;
  readOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  theme?: string;
}

export default class CodeEditor extends React.Component<Props, {}> {
  static contextType = Player.Context;
  editor: Editor;
  placeholder: HTMLDivElement;
  ready: Promise<void>;
  private setReady: () => void;
  private player: Player;
  private recording: boolean;

  static defaultProps = {
    keyMap: {},
    readOnly: false,
    style: {}
  }

  constructor(props: Props, context: Player) {
    super(props, context);
    this.player = context;

    this.recording = false;

    this.ready = new Promise((resolve) => {
      this.setReady = resolve;
    });
  }
  
  async componentDidMount() {
    const defaults = {
      indentUnit: 4,
      lineNumbers: true,
      tabSize: 4
    };
    const options = Object.assign(defaults, whitelist(this.props, ["mode", "readOnly", "theme"]));
    this.editor = window.CodeMirror(
      (elt) => {
        this.placeholder.parentNode.replaceChild(elt, this.placeholder);
      },
      options
    );

    /* copy props */
    const wrapper = this.editor.getWrapperElement();
    Object.assign(wrapper.style, this.props.style);
    const classNames = this.props.className ? this.props.className.split(" ") : [];
    for (const className of classNames) {
      wrapper.classList.add(className);
    }

    /* event handlers */
    // avoid pausing video
    wrapper.addEventListener("mouseup", Player.preventCanvasClick);

    this.editor.on("keydown", (cm, e) => {
      if (!e.key.match(/^[A-Z]$/i)) return;

      this.editor.showHint({
        hint: window.CodeMirror.hint.anyword,
        completeSingle: false,
        customKeys: {
          "Cmd-/": (cm: Editor, handle: Handle) => handle.close(),
          Tab: (cm: Editor, handle: Handle) => handle.pick()
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

      this.player.resumeKeyCapture();
    });

    /* keyboard shortcuts */
    const keyMap = Object.assign(
      {},
      {
        Tab(cm: CodeMirror.Editor) {
          const spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
          cm.getDoc().replaceSelection(spaces);
        }
      },
      this.props.keyMap
    );

    for (const n of [2, 3, 4]) {
      keyMap[`Cmd-Alt-${n}`] = () => {
        if (!this.recording) return;
        this.player.resumeKeyCapture();

        document.body.dispatchEvent(new KeyboardEvent(
          "keydown",
          {code: `Digit${n}`, altKey: true, metaKey: true}
        ));

        this.player.suspendKeyCapture();
      };
    }

    this.editor.addKeyMap(keyMap);

    this.setReady();
  }

  shouldComponentUpdate(nextProps: Props) {
    if (!this.editor) return;

    const declaration = this.editor.getWrapperElement().style;

    for (const key in this.props.style) {
      if (!nextProps.hasOwnProperty(key)) {
        declaration.removeProperty(camel2dash(key));
      }
    }

    Object.assign(declaration, nextProps.style);

    return false;
  }

  connect() {
    this.recording = true;
  }

  disconnect() {
    this.recording = false;
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
