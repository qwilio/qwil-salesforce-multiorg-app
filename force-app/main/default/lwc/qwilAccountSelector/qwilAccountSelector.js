import { LightningElement, api } from "lwc";

export default class QwilAccountSelector extends LightningElement {
  @api accounts;

  handleSelected(event) {
    // propagate event to caller
    this.dispatchEvent(
      new CustomEvent("selected", { detail: { ...event.detail } })
    );
  }
}
