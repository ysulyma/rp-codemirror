import * as React from "react";
import {Player, Utils} from "ractive-player";
const {bind} = Utils.misc,
      {parseTime} = Utils.time;
import type {ReplayData} from "ractive-player";

import CodeEditor from "./CodeEditor";

// issues are:

// # sort of have to ignore the existing cursor

// # need to do this state recreation bullshit

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
  command: (dir: "fwd" | "back", data: string, state: CRState) => void;
  mode?: string;
  replay: CaptureData;
  start: number | string;
  className?: string;
  style?: React.CSSProperties;
  theme?: string;
}

interface CRState {
  cursor: CodeMirror.Position;
  selection: CMSelection;
  value: string[];
}

type ReplayCommand = CaptureData extends ReplayData<infer T> ? T extends [infer A, infer B] ? {type: A; data: B; state: CRState} : never : never;

export default class CodeReplay extends React.Component<Props, Record<string, never>> {
  static contextType = Player.Context;

  private i: number;
  private lastTime: number;
  private player: Player;
  private replay: CaptureData;
  private times: number[];
  private broadcast?: Broadcast;

  codeEditor: CodeEditor;
  cursor: HTMLDivElement;
  cursorDiv: HTMLDivElement;
  cursorState: CodeMirror.Position;
  duration: number;
  selectionsDiv: HTMLDivElement;
  start: number;

  static defaultProps: Partial<Props> = {
    replay: []
  }

  constructor(props: Props, context: Player) {
    super(props, context);
    this.player = context;

    bind(this, ["blinkCursor", "onTimeUpdate", "poll"]);

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
    this.broadcast = props.broadcast;

    this.replay = this.props.replay;

    this.times = this.replay.map(_ => _[0]);
    for (let i = 1; i < this.times.length; ++i)
      this.times[i] += this.times[i-1];

    if (this.replay.length === 0)
      return;
    this.duration = this.times[this.times.length - 1];
  }

  async poll(data: CaptureData) {
    this.replay.push(...data);

    let sum = this.times.length === 0 ? 0 : this.times[this.times.length - 1];
    for (const [t] of data) {
      this.times.push(sum + t);
      sum += t;
    }
    this.duration = this.times[this.times.length - 1];
  }

  componentDidMount() {
    const {playback} = this.player;

    // event hooks
    playback.hub.on("seek", this.onTimeUpdate);
    playback.hub.on("timeupdate", this.onTimeUpdate);

    this.codeEditor.ready.then(() => {
      const cm = this.codeEditor.editor;

      // manage the cursor ourselves
      const oldCursorDiv = cm.getWrapperElement().querySelector(".CodeMirror-cursors");

      this.cursorDiv = fromHTML(`
        <div class="CodeMirror-cursors">
          <div class="CodeMirror-cursor">\u00a0</div>
        </div>
      `) as HTMLDivElement;
      this.cursor = this.cursorDiv.firstElementChild as HTMLDivElement;

      oldCursorDiv.parentNode.replaceChild(this.cursorDiv, oldCursorDiv);

      this.setCursor(this.getCursor());
      setInterval(this.blinkCursor, cm.getOption("cursorBlinkRate"));

      // also manage a fake selection ourselves...
      this.selectionsDiv = fromHTML("<div style=\"position: relative;z-index: 1;\"/>") as HTMLDivElement;
      this.cursorDiv.parentNode.insertBefore(this.selectionsDiv, this.cursorDiv); // yikes
    });
  }

  onTimeUpdate(t: number) {
    const progress = t - this.start;
    const cm = this.codeEditor.editor;
    if (!cm) return;
    const state = {
      cursor: this.getCursor(),
      selection: cm.getDoc().listSelections()[0],
      value: cm.getValue().split("\n")
    };

    const lastI = this.i;

    // for performance reasons when seeking, we batch updates
    // and mimic cm.replaceRange() instead of calling
    // cm.replaceRange() repeatedly (reparses the whole doc etc.)
    if (this.lastTime <= t && this.i < this.replay.length) {
      let i = this.i;
      for (; i < this.replay.length && this.times[i] <= progress; ++i) {
        const [, [type, data]] = this.replay[i];
        this.fwd({type, data, state} as ReplayCommand);
      }
      this.i = i;
    } else if (t < this.lastTime && 0 < this.i) {
      let i = this.i - 1;
      for (; 0 <= i && progress < this.times[i]; --i) {
        const [, [type, data]] = this.replay[i];
        this.back({type, data, state} as ReplayCommand);
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

  fwd(_: ReplayCommand) {
    switch (_.type) {
    case "command":
      this.props.command("fwd", _.data, _.state);
      break;
    case "cursor":
      _.state.cursor = _.data;
      break;
    case "selection":
      _.state.selection = _.data;
      break;
    case "text":
      replaceRange(_.state.value, _.data.text, _.data.from, _.data.to);
      break;
    }
  }

  back(_: ReplayCommand) {
    switch(_.type) {
    case "command":
      this.props.command("back", _.data, _.state);
      break;
    case "cursor":
      break;
    case "text":
      const from = {line: _.data.from.line, ch: _.data.from.ch},
            to = {
              line: _.data.from.line + _.data.text.length - 1,
              ch: _.data.text.length === 1 ? _.data.from.ch + _.data.text[0].length : _.data.text[_.data.text.length - 1].length
            };

      replaceRange(_.state.value, _.data.removed, from, to);
      break;
    }
  }

  blinkCursor() {
    this.cursorDiv.style.visibility = (this.cursorDiv.style.visibility === "hidden") ? "visible" : "hidden";
  }

  getCursor() {
    return this.cursorState;
  }

  setCursor({line, ch}: {line: number; ch: number}) {
    const cm = this.codeEditor.editor,
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
    const cm = this.codeEditor.editor;

    while (this.selectionsDiv.firstChild)
      this.selectionsDiv.lastChild.remove();

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
      const elt = fromHTML("<div class=\"CodeMirror-selected\" style=\"position: absolute;\"></div>") as HTMLDivElement;
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
    const attrs = whitelist(this.props, ["className", "mode", "style", "theme"]);

    return (
      <CodeEditor
        ref={pye => this.codeEditor = pye}
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

/* helper functions */
function fromHTML(str: string) {
  const t = document.createElement("template");
  t.innerHTML = str;
  return (t.content.cloneNode(true) as DocumentFragment).firstElementChild;
}
