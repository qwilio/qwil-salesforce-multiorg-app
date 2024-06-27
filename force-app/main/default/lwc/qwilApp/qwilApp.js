import { LightningElement } from "lwc";
import getEntityMemberships from "@salesforce/apex/QwilSdk.getEntityMemberships";

export default class QwilApp extends LightningElement {
  loaded = false;
  isMultiOrg;
  error;
  accountsForSelection;
  selected;

  async reloadAccounts() {
    const accounts = await this.loadAccounts();
    this.loaded = true;
    this.isMultiOrg = false;

    // Handle case where we are unable to find associated qwil accounts
    if (this.error) {
      return;
    }

    this.isMultiOrg = accounts.length > 1;

    if (accounts.length === 0) {
      // show error if no accounts found
      console.error("No entity-memberships found.");
      this.error = "Could not locate your Qwil account";
    } else if (accounts.length === 1) {
      // immediately load Qwil if only one account found
      this.selected = accounts[0];
    } else {
      this.accountsForSelection = accounts;
    }
  }

  async connectedCallback() {
    return this.reloadAccounts();
  }

  async loadAccounts() {
    let response;
    try {
      response = JSON.parse(await getEntityMemberships());
    } catch (error) {
      console.error(error);
      this.error = error?.body?.message || "Load failed";
    }

    const accounts = response?.entity_memberships || [];
    return accounts.map(this.parseEntityMembership);
  }

  parseEntityMembership(membership) {
    const org = membership.entity;
    const user = membership.user;
    return {
      entityUuid: org.entity_uuid,
      orgName: org.name,
      orgAvatar: org.avatar_url || "",
      orgLogo: org.logo_url || "",
      entityUserXrefUuid: user.entity_user_xref_uuid
    };
  }

  handleSelected(event) {
    this.accountsForSelection = null;
    this.selected = { ...event.detail };
  }

  handleExit() {
    this.selected = null;
    this.loaded = false;
    this.reloadAccounts();
  }
}
