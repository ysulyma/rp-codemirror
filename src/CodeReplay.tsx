import * as React from "react";
import {Playback, Script, Player, Utils, ReplayData} from "ractive-player";

import PythonEditor from "./PythonEditor";
import PythonInterpreter from "../lib/PythonInterpreter";

// issues are:

// # sort of have to ignore the existing cursor

// # need to do this state recreation bullshit

import * as dom from "@webu/utils/dom";
import {bind} from "@webu/utils/misc";

const {parseTime} = Utils.time;

interface CMSelection {
  anchor: CodeMirror.Position;
  head: CodeMirror.Position;
}

interface Change {
  from: CodeMirror.Position;
  to: CodeMirror.Position;
  text: string[];
  removed: string[];
}

export type CaptureData = ReplayData<
["command", string] |
["cursor", CodeMirror.Position] |
["selection", CMSelection] |
["text", Change]
>;

interface Props {
  command: Function;
  replay: CaptureData;
  start: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export default class CodeReplay extends React.Component<Props, {}> {
  static contextType = Player.Context;
  i: number;
  lastTime: number;
  cursorState: CodeMirror.Position;
  times: number[];
  duration: number;
  replay: CaptureData;
  PythonEditor: PythonEditor;
  selectionsDiv: HTMLDivElement;
  start: number;
  cursor: HTMLDivElement;
  cursorDiv: HTMLDivElement;

  private player: Player;

  static defaultProps = {
    data: []
  }

  constructor(props: Props, context: Player) {
    super(props, context);
    this.player = context;

    bind(this, ["blinkCursor", "onTimeUpdate"]);

    // parse start
    if (typeof props.start === "string") {
      if (props.start.match(/^(?:(?:(\d+):)?(\d+):)?(\d+)(?:\.(\d+))?$/))
        this.start = parseTime(props.start);
      else
        this.start = this.player.script.markerByName(props.start)[1];
    } else {
      this.start = props.start;
    }

    // cursor
    this.i = 0;
    this.lastTime = 0;
    this.cursorState = {line: 0, ch: 0};

    // figure out duration
    const {replay} = this.props;

    this.times = replay.map(_ => _[0]);
    for (let i = 1; i < this.times.length; ++i)
      this.times[i] += this.times[i-1];

    if (replay.length === 0) return;
    this.duration = this.times[this.times.length - 1];
  }

  componentDidMount() {
    const {playback} = this.player;

    // event hooks
    playback.hub.on("seek", this.onTimeUpdate);
    playback.hub.on("timeupdate", this.onTimeUpdate);

    this.PythonEditor.ready.then(() => {
      const cm = this.PythonEditor.editor;

      // manage the cursor ourselves
      const oldCursorDiv = cm.getWrapperElement().querySelector(".CodeMirror-cursors");

      this.cursorDiv = dom.fromHTML(`
        <div class="CodeMirror-cursors">
          <div class="CodeMirror-cursor">\u00a0</div>
        </div>
      `) as HTMLDivElement;
      this.cursor = this.cursorDiv.firstElementChild as HTMLDivElement;

      oldCursorDiv.parentNode.replaceChild(this.cursorDiv, oldCursorDiv);

      this.setCursor(this.getCursor());
      setInterval(this.blinkCursor, cm.getOption("cursorBlinkRate"));

      // also manage a fake selection ourselves...
      this.selectionsDiv = dom.fromHTML("<div style=\"position: relative;z-index: 1;\"/>") as HTMLDivElement;
      this.cursorDiv.parentNode.insertBefore(this.selectionsDiv, this.cursorDiv); // jesus fucking christ
    });
  }

  onTimeUpdate(t: number) {
    const progress = t - this.start;
    const cm = this.PythonEditor.editor;
    if (!cm) return;
    const state = {
      cursor: this.getCursor(),
      selection: cm.getDoc().listSelections()[0],
      value: cm.getValue().split("\n")
    };
    const {replay} = this.props;

    const lastI = this.i;

    // for performance reasons when seeking, we batch updates
    // and mimic cm.replaceRange() instead of calling
    // cm.replaceRange() repeatedly (reparses the whole doc etc.)
    if (this.lastTime <= t && this.i < replay.length) {
      let i = this.i;
      for (; i < replay.length && this.times[i] <= progress; ++i) {
        const [, [type, data]] = replay[i];
        this.fwd(type, data, state);
      }
      this.i = i;
    } else if (t < this.lastTime && 0 < this.i) {
      let i = this.i - 1;
      for (; 0 <= i && progress < this.times[i]; --i) {
        const [, [type, data]] = replay[i];
        this.back(type, data, state);
      }
      this.i = i + 1;
    }

    if (this.i !== lastI) {
      // save user interaction state
      const {left, top} = cm.getScrollInfo();
      const selection = cm.getDoc().listSelections()[0];

      // mutate
      cm.setValue(state.value.join("\n"));
      this.setSelection(state.selection.anchor, state.selection.head);
      this.setCursor(state.cursor);

      // restore user interaction state
      cm.getDoc().setSelection(selection.anchor, selection.head);
      cm.scrollTo(left, top);
    }

    this.lastTime = t;
  }

  fwd(type, data, state) {
    const cm = this.PythonEditor.editor;

    switch (type) {
    case "command":
      this.props.command("fwd", data, state);
      break;
    case "cursor":
      state.cursor = data;
      break;
    case "selection":
      state.selection = data;
      break;
    case "text":
      replaceRange(state.value, data.text, data.from, data.to);
      break;
    }
  }

  back(type, data, state) {
    const cm = this.PythonEditor.editor;

    switch(type) {
    case "command":
      this.props.command("back", data, state);
      break;
    case "cursor":
      break;
    case "text":
      const from = {line: data.from.line, ch: data.from.ch},
            to = {
              line: data.from.line + data.text.length - 1,
              ch: data.text.length === 1 ? data.from.ch + data.text[0].length : data.text[data.text.length - 1].length
            };

      replaceRange(state.value, data.removed, from, to);
      break;
    }
  }

  blinkCursor() {
    this.cursorDiv.style.visibility = (this.cursorDiv.style.visibility === "hidden") ? "visible" : "hidden";
  }

  getCursor() {
    return this.cursorState;
  }

  setCursor({line, ch}: {line: number; ch: number;}) {
    const cm = this.PythonEditor.editor,
          coords = cm.cursorCoords({line, ch: ch}, "div");

    const height = Math.max(0, coords.bottom - coords.top) * cm.getOption("cursorHeight");

    Object.assign(this.cursor.style, {
      left: `${coords.left}px`,
      top: `${coords.top}px`,
      height: `${height}px`
    });

    this.cursorState = {line, ch};
  }

  setSelection(anchor: CodeMirror.Position, head: CodeMirror.Position) {
    const cm = this.PythonEditor.editor;

    dom.empty(this.selectionsDiv);

    const anchorCoords = cm.cursorCoords(anchor, "div"),
          headCoords = cm.cursorCoords(head, "div"),
          startCoords = cm.cursorCoords({line: 0, ch: 0}, "div");

    const height = Math.max(0, anchorCoords.bottom - anchorCoords.top) * cm.getOption("cursorHeight"),
          maxWidth = cm.getWrapperElement().getBoundingClientRect().width;

    for (let i = anchor.line; i <= head.line; ++i) {
      const top = anchorCoords.top + (i - anchor.line) * height;
      const left = (i === anchor.line ? anchorCoords : startCoords).left;
      let width;
      if (i === anchor.line) {
        if (anchor.line === head.line)
          width = headCoords.left - anchorCoords.left;
        else
          width = maxWidth - anchorCoords.left;
      } else if (i === head.line) {
        width = headCoords.left - startCoords.left;
      } else {
        width = maxWidth;
      }
      
      const line = makeLine(left, top, width, height);
      this.selectionsDiv.appendChild(line);
    }

    function makeLine(left: number, top: number, width: number, height: number) {
      const elt = dom.fromHTML("<div class=\"CodeMirror-selected\" style=\"position: absolute;\"></div>") as HTMLDivElement;
      Object.assign(elt.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`
      });
      return elt;
    }
  }

  render() {
    const attrs = whitelist(this.props, ["className", "style"]);

    return (
      <PythonEditor
        ref={pye => this.PythonEditor = pye}
        readOnly={true}
        {...attrs}/>
    );
  }
}

/* CodeMirror faking */
function replaceRange(value: string[], text: string[], from: CodeMirror.Position, to: CodeMirror.Position) {
  from = clipPos(value, from);
  to = clipPos(value, to);

  const head = value[from.line].slice(0, from.ch),
        tail = value[to.line].slice(to.ch, value[to.line].length);

  const replacement =
      (text.length === 1) ?
        [head + text[0] + tail] :
        [head + text[0], ...text.slice(1, text.length - 1), text[text.length - 1] + tail];

  value.splice(from.line, to.line - from.line + 1, ...replacement);
}

function clipPos(value: string[], pos: CodeMirror.Position) {
  const last = value.length - 1;
  if (pos.line > last) return {line: last, ch: value[last].length};
  return clipToLen(pos, value[pos.line].length);
}

function clipToLen(pos: CodeMirror.Position, linelen: number) {
  if (pos.ch == null || pos.ch > linelen) return {line: pos.line, ch: linelen};
  if (pos.ch < 0) return {line: pos.line, ch: 0};
  return pos;
}

function whitelist<T, K extends keyof T>(obj: T, keys: K[]) {
  return keys.map(k => k in obj ? {[k]: obj[k]} : {})
         .reduce((res, o) => Object.assign(res, o), {}) as Pick<T, K>;
}
