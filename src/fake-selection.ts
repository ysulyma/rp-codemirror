import {Extension, SelectionRange, StateEffect} from "@codemirror/state";
import type {EditorView, ViewUpdate} from "@codemirror/view";

export interface Range {
  anchor: number;
  head: number;
}
export const FakeSelection = StateEffect.define<Range>();

interface DrawSelection {
  cursorLayer: HTMLDivElement;
  measureReq: {
    read: () => {
      cursors: {
        draw: () => HTMLDivElement;
      }[];
    };
    write: () => unknown;
  }
  range: SelectionRange;
  update(update: ViewUpdate): void;
  view: EditorView;
}

export function fakeSelection(drawSelection: Extension[]): (view: EditorView) => DrawSelection {
  // @ts-expect-error create is not exposed
  const create = drawSelection[1].create as (view: EditorView) => DrawSelection;

  return function (view: EditorView){
    const instance = create(view);
    instance.cursorLayer.classList.add("fake");

    Object.assign(instance.cursorLayer.style, {
      animationIterationCount: "infinite",
      animationName: "cm-blink",
      animationTimingFunction: "steps(1)"
    });

    // intercept read method
    // this is so evil
    const readPos = instance.measureReq.read;
    instance.measureReq.read = function(this: DrawSelection) {
      const ranges = this.view.state.selection.ranges;

      if (this.range) {
        // @ts-expect-error ranges is readonly
        this.view.state.selection.ranges = [this.range];
      }
      const measure = readPos();

      // @ts-expect-error ranges is readonly
      this.view.state.selection.ranges = ranges;

      for (const c of measure.cursors) {
        const draw = c.draw.bind(c);
        c.draw = function() {
          const elt = draw();
          elt.style.display = "block";
          return elt;
        };
      }
      return measure;
    }.bind(instance);

    // update method
    instance.update = function(this: DrawSelection, update: ViewUpdate) {
      const effects =
        update.transactions
        .map(tr => tr.effects.filter(e => e.is(FakeSelection)) as StateEffect<Range>[])
        .reduce((a,b)=>a.concat(b), []);

      if (effects.length > 0) {
        this.range = SelectionRange.fromJSON(effects[effects.length - 1].value);
        this.view.requestMeasure(this.measureReq);
      }
    };

    return instance;
  };
}
