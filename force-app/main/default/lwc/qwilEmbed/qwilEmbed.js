import { LightningElement, api } from "lwc";
import Toast from "lightning/toast";
import { loadScript } from "lightning/platformResourceLoader";
import QwilApiLib from "@salesforce/resourceUrl/QwilApiLib";
import authenticate from "@salesforce/apex/QwilSdk.authenticate";

export default class QwilEmbed extends LightningElement {
  @api entityUuid;
  @api entityUserXrefUuid;

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

    this.qwilApi = new window.QwilApi({
      token,
      endpoint,
      options: {
        emitDownloads: true, // handle downloads ourselves
        contactsTappable: true // make contacts tappable, and emit click-on-contact event
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
      },
      // Handle error case where we have token from Apex call, but we fail to load Qwil using said token.
      onError: () => {
        this.error = "Login to Qwil failed";
        this.loaded = true;
      }
    });
  }

  downloadFileFromUrl(url, filename) {
    const element = document.createElement("a");
    element.href = url;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    element.remove();
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
