import {KeyMap, Player} from "liqvid";

import type {DOMEventHandlers, KeyBinding} from "@codemirror/view";

/**
Handle key sequences in `seqs` even if key capture is suspended.
*/
export function passThrough(player: Player, seqs: string[] = []): KeyBinding[] {
  return seqs.map(key => {
    const can = cm2rp(key);

    // argh
    const fake = new KeyboardEvent("keydown");

    return {
      key,
      run: () => {
        const handlers = player.keymap.getHandlers(can);
        for (const cb of handlers) {
          cb(fake);
        }
        return false;
      }
    } as KeyBinding;
  });
}

/**
Prevent Liqvid events from firing inside text editor.
*/
export function suspendControls(player: Player): DOMEventHandlers<void> {
  return {
    blur: () => player.resumeKeyCapture(),
    focus: () => player.suspendKeyCapture(),
    mouseup: Player.preventCanvasClick
  };
}

/**
Convert CodeMirror key sequences to RP format.
**/
const mac = navigator.platform === "MacIntel";
function cm2rp(seq: string) {
  seq = seq.replace("Mod", mac ? "Meta" : "Ctrl");
  seq = seq.replace(/-/g, "+");
  return KeyMap.normalize(seq);
}
