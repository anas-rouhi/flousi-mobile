/**
 * Browser version of React Native's `Alert.alert(title, message, buttons)`.
 *
 * Mapped onto the browser's own dialogs so every existing call site works
 * unchanged:
 *  - a cancel button plus an action → window.confirm; OK runs the action,
 *    Cancel runs the cancel button's handler (if any);
 *  - anything else → window.alert, then the first button's handler.
 *
 * Handlers run on the next tick, as they would after a native dialog closes.
 */
function run(button) {
  if (typeof button?.onPress === "function") {
    setTimeout(() => button.onPress(), 0);
  }
}

function alert(title, message, buttons = []) {
  const text = [title, message].filter(Boolean).join("\n\n");
  const cancel = buttons.find((button) => button?.style === "cancel");
  const actions = buttons.filter((button) => button && button !== cancel);

  if (cancel && actions.length > 0) {
    // With several actions the first is the one a confirm can offer.
    if (window.confirm(text)) {
      run(actions[0]);
    } else {
      run(cancel);
    }
    return;
  }

  window.alert(text);
  run(actions[0] ?? cancel);
}

export const Alert = { alert };
