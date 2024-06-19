# Qwil Salesforce Multiorg App

This is an example Salesforce DX project then embeds Qwil as a Lightning Web Component.

It extends [qwil-salesforce-app](https://github.com/qwilio/qwil-salesforce-app) by allowing each salesforce user to access one or more Qwil accounts across different Qwil organisations.
Lookup is based on matching Salesforce username to primary email address in Qwil accounts.

⚠️ This setup can only be used if you have a dedicated Qwil Hosting and access to a Super API Key for cross-entity queries. If you don't have this, take a look at [qwil-salesforce-app](https://github.com/qwilio/qwil-salesforce-app) instead.

This example consists of the following elements:

1. The [QwilSdk](force-app/main/default/classes/QwilSdk.cls) Apex class
   - This provides functions that does callouts to Qwil Sys API to :
     1. retrieve a list of Qwil acccounts (staff or client) that has a primary email address matching the username of the current Salesforce user.
     2. create SDK session token for a given Qwil account.
2. The [QwilApiLib.js](force-app/main/default/staticresources/QwilApiLib.js) static resource
   - This is a copy of the [Qwil IFrame API](https://github.com/qwilio/qwil-iframe-api).
3. [Lightning Web Components](force-app/main/default/lwc/)
   - [qwilApp](force-app/main/default/lwc/qwilApp): Main app entry point.
   - [qwilEmbed](force-app/main/default/lwc/qwilEmbed): Component that loads QwilApi and embeds the iFrame.
   - [qwilAccountSelector](force-app/main/default/lwc/qwilAccountSelector): Account selector component, used when the Salesforce user has more than one associated Qwil account.
4. The [Qwil](force-app/main/default/aura/Qwil/Qwil.cmp) Aura component
   - This is a very light wrapper around the `qwilEmbed` LWC, which allows us to add it as a salesforce tab without additional paddings around the component.

## Setup

1. Deploy project to org
   ```
   sf project deploy start
   ```
2. Get a Super API Key
   - In Qwil, create a System API Key with the following permissions:
     - _"This key can create SDK tokens"_
     - _"This key can perform read-only admin actions"_
   - You must set CIDR block restrictions for this key.
   - Get in touch with your Qwil contact to get your key promoted to a Super API Key (You will need to be on an Enterprise plan and have dedicated Qwil Hosting).
3. In the Salesforce org, create an External Credential for the Qwil System API Key.
   - Under "Setup > Named Credentials", select the "External Credentials" tab and create a new entry
     - Choose an appropriate Label and Name
     - Authentication Protocol: Custom
     - Add a Pricipal - "Qwil SDK"
     - Add the following Custom Headers and provide values for your Super API key:
       - `X-SYS-API-KEY`
       - `X-SYS-API-KEY-SECRET`
4. Create a Named Creadential that will be used for the Qwil Sys API callout
   - Under "Setup > Named Credentials", select the "Named Credentials" tab and create a new entry
     - Name: `QwilSysApiSDK`
     - Label: `Qwil Sys API (SDK)`
     - URL: `https://<REGION>.qwil.io/entity-service/sys-api/sdk`.
     - Enabled for Callouts: checked
     - Authentication: Select the external credential created in the previous step
     - Under Callout Options, **uncheck** "Generate Authorization Header"
5. Give profiles access to the callout
   - Under "Setup > Users > Profiles", for each profile that is allowed to use Qwil:
     - Select the profile
     - Edit "Enabled External Credential Pricipal Access" and add the External Credential created in previous steps
6. Add \*.qwil.io to Trusted URLs to avoid CSP issues
   - Under "Setup > Trusted URLs", click "New Trusted URL"
     - Api Name: Qwil
     - URL: https://\*.qwil.io
     - CSP Context: All
     - CSP Directives: select "frame-src" and "img-src"
7. Create a Tab for Qwil
   - Under "Setup > Tabs", create a new "Lightning Component Tab".
   - Lightning Component: `c:Qwil`
8. Add the Tab to app
   - Under "Setup > App Manager", add the tab to the desired project(s)
