import { LightningElement, api } from "lwc";

export default class QwilAccountSelectorItem extends LightningElement {
  @api account;

  handleClick(event) {
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent("selected", { detail: { ...this.account } })
    );
  }
}
