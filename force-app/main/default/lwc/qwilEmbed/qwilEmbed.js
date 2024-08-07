import { LightningElement, api } from "lwc";
import Toast from "lightning/toast";
import FORM_FACTOR from "@salesforce/client/formFactor";
import { loadScript } from "lightning/platformResourceLoader";
import QwilApiLib from "@salesforce/resourceUrl/QwilApiLib";
import authenticate from "@salesforce/apex/QwilSdk.authenticate";

export default class QwilEmbed extends LightningElement {
  @api entityUuid;
  @api entityUserXrefUuid;
  @api orgName;
  @api orgLogo;
  @api isMultiOrg;

  credentials;
  qwilApi;
  error;
  loaded = false;

  async connectedCallback() {
    await Promise.all([
      loadScript(this, QwilApiLib), // this exposes api obj on window.QwilApi
      this.retrieveCredentials() // this populates either this.credentials or this.error
    ]);

    const container = this.template.querySelector("div.qwil-container");

    // Handle case where we fail to get SDK token from Apex call
    if (this.error) {
      container.classList.remove("full-page");
      this.loaded = true;
      return;
    }

    // If no error, credentials should have been populated
    const { token, endpoint } = this.credentials;

    const emitDownloads = !this.isRunningOnDesktop(); // on mobile downloads from iframe do not work so we handle on this end.

    this.qwilApi = new window.QwilApi({
      token,
      endpoint,
      options: {
        emitDownloads,
        contactsTappable: true, // make contacts tappable, and emit click-on-contact event
        emitMeetingJoin: true, // handle opening window ourself since salesforce mobile app blocks iframe from doing so
        emitChatListBack: this.isMultiOrg, // if multi-org, display back button on chat list, so we can take users back to org selector
        chatListTitle: this.orgName,
        chatListLogo: this.orgLogo
      },
      targetElement: container,
      onLoad: (qwilApi) => {
        console.log("Qwil login successful");
        this.loaded = true;

        // Handle auth expiry while app is rendered
        qwilApi.on("auth-expired", async () => {
          console.warn("Qwil session expired. Reauthenticating.");

          await this.retrieveCredentials();
          if (!this.error) {
            qwilApi.reauthenticate({
              token: this.credentials.token,
              endpoint: this.credentials.endpoint
            });
          }
        });

        // this only works if contactsTappable option is set
        qwilApi.on("click-on-contact", (payload) => {
          // Crude example. But you can do a lot more with this, e.g. lookup associated salesforce contact and display in modal.
          this.showContactToast(payload);
        });

        // Display in-app error events as toast
        qwilApi.on("app-error", ({ message }) => {
          this.showErrorToast(message);
        });

        // Downloads triggered from within the iFrame does not work on SF mobile, so we handle it here
        qwilApi.on("download-request", ({ filename, url }) =>
          this.downloadFileFromUrl(url, filename)
        );

        // Opening external window from iFrame does not work on SF mobile, so we handle it here
        qwilApi.on("meeting-join", ({ url }) => this.openUrlInNewWindow(url));

        // When users click back button on chat list, we emit an event so the caller can take them back to the org selector
        qwilApi.on("chat-list-back", () => {
          this.dispatchEvent(
            new CustomEvent("exit", { detail: { ...this.account } })
          );
        });
      },
      // Handle error case where we have token from Apex call, but we fail to load Qwil using said token.
      onError: () => {
        this.error = "Login to Qwil failed";
        this.loaded = true;
      }
    });
  }

  isRunningOnDesktop() {
    return FORM_FACTOR === "Large";
  }

  downloadFileFromUrl(url, filename) {
    const downloadContainer = this.template.querySelector(
      ".download-container"
    );
    const element = document.createElement("a");
    element.href = url;
    element.download = filename;
    downloadContainer.append(element);
    element.click();
    downloadContainer.removeChild(element);
  }

  openUrlInNewWindow(url) {
    //// window.open behaves strangely on Android SF app. It first navigates to blank page before open, leaving app in bad state
    // window.open(url, '_blank')
    const downloadContainer = this.template.querySelector(
      ".download-container"
    );
    const element = document.createElement("a");
    element.href = url;
    element.target = "_blank";
    downloadContainer.append(element);
    element.click();
    downloadContainer.removeChild(element);
  }

  async retrieveCredentials() {
    let response;
    try {
      response = JSON.parse(
        await authenticate({
          entityUuid: this.entityUuid,
          entityUserXrefUuid: this.entityUserXrefUuid
        })
      );
    } catch (error) {
      console.error(error);
      this.error = error?.body?.message || "Load failed";
    }
    this.credentials = {
      token: response.sdk_token,
      endpoint: response.api_base_url
    };
  }

  async disconnectedCallback() {
    if (this.api) {
      this.api.destroy();
      this.api = null;
    }
  }

  showErrorToast(message) {
    Toast.show(
      {
        label: "Qwil Chat",
        message,
        mode: "dismissable",
        variant: "warning"
      },
      this
    );
  }

  showContactToast(payload) {
    const message =
      "Salesforce app received event with payload " + JSON.stringify(payload);
    Toast.show(
      {
        label: "Qwil click-on-contact",
        message,
        mode: "dismissable",
        variant: "success"
      },
      this
    );
  }
}
