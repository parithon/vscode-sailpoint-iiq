<div style="text-align: center;">

![vscode-sailpoint-iiq icon](./media/iiqexplore-256.png "vscode-sailpoint-iiq icon")

# VSCode SailPoint IdentityIQ Extension

</div>

![GitHub package.json version](https://img.shields.io/github/package-json/v/parithon/vscode-sailpoint-iiq?label=github%20version&style=for-the-badge)
![GitHub top language](https://img.shields.io/github/languages/top/parithon/vscode-sailpoint-iiq?style=for-the-badge)
![Snyk Vulnerabilities for GitHub Repo](https://img.shields.io/snyk/vulnerabilities/github/parithon/vscode-sailpoint-iiq?label=SYNK%20Vulnerabilities&style=for-the-badge)
<!-- ![GitHub all releases](https://img.shields.io/github/downloads/parithon/vscode-sailpoint-iiq/total?style=for-the-badge) -->
<!-- ![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/1?label=Marketplace%20Version&style=for-the-badge) -->

This is the `README` for the [vscode-sailpoint-iiq](https://marketplace.visualstudio.com/items?itemName=parithon.vscode-sailpoint-iiq) visual studio code extension. With this extension you will be able to communicate directly with your IdentityIQ server from within vscode!

# Requrirements
In order to use this extension, you will need a running a [SailPoint IdentityIQ](https://www.sailpoint.com/products/identityIQ) instance and you will need to have the appropriate permissions to create and update workflows and access the REST API. Today, that requires that you are an admin within your instance.

# Prerequirement
We use the workflow REST APIs in order to communicate with your IdentityIQ environment. In order to call the appropriate workflow, with the methods we use for this extension, you will need to import the workflow into your environment.

- An initial import of the `./media/VSCodeExtgensionWF.xml` file in order for this extension to interact with your IdentityIQ server. After this initial import is completed, this extension can update the workflow whenever an newer version has been released.

# Features
The following features have been implmented into this extension. Additional features will be added as time permits.

## Commands:

- **Publish File** will publish the currently active text document to your IdentityIQ environment. If you are using a Services Standard Build (SSB) project, this will replace the tokens with the appropriate environment you have enabled.

- **Run Task** allows you to run a task on your IdentityIQ environment. This may be with or without any parameters

- **Run Rule** allows you to run a rule on your IdentityIQ environment. If an argument is expected the currently active text document will be evaluated using the SST layout; if no match is found an input will allow you to provide the argument.

- **Evaluate Beanshell Script** will execute in your IdentityIQ environment the code you've seleted. 
  - In order to observe the results, ensure that you include a `return` statement.
  - After execution is complete, the results will be presented by a virtual document.
  - You can also check your log file.

- **Switch Environment** allows you to switch between multiple `*.target.properties` files.
  - Ensure your *.target.properties document includes the `%%ECLIPSE_URL%%` token, this will be used to tell the extension which URL to communicate with.
  - Do not include the following tokens as they will be ignored: `%%ECLIPSE_USER%%` and `%%ECLIPSE_PASS%%`

- **Compare with Server** will open a comparison between your local copy of a file and what is currently deployed within your IdentityIQ environment.

## User Interface:

- **IdentityIQ Activity View** will show you all the objects currently deployed in your IdentityIQ environment. From there, you can download the entire category or individual objects. If you're using SSB, the documents will be downloaded and values replaced with the tokens found in your projects current selected environment `*.target.properties` file.

- **Status Indicator** will show the currently selected environment, the username used to connect to your IdentityIQ server and provide some information about the server you're communicating with.

- **Syntax Highlighting** will be used within your beanshell documents. Your Java code will be colorized within your XML+beanshell documents.
