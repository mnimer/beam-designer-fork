# GEMINI.MD: AI Collaboration Guide

This document provides essential context for AI models interacting with this project. Adhering to these guidelines will ensure consistency and maintain code quality.

## Project Overview & Purpose

* **Primary Goal:** The primary goal of the project is to create a **Next.js web application** that acts as a **Data Catalog** and **SQL Query Runner** for multiple Google BigQuery datasets. It serves as a "single pane of glass" for managing a customers Retail Data (customers, stores, products).  It will read data from BigQuery and publish changes back to PubSub. 

* **Business Domain:** Retail Data Manaagement

## Core Technologies & Stack

* **Languages:** Terraform, Node, SQL, TypeScript
* **Frameworks & Runtimes:** Node.js.
* **Databases:** Google BigQuery and PubSub (send application events for changes)
* **Key Libraries/Dependencies:** The project is heavily reliant on the Google Cloud SDK
* **Package Manager(s):** pip (for Python, via `requirements.txt` files), NPM for node.
* **Gemini libraries:** when calling gemini sdk, use the "@google/genai" library and the 'gemini-3.5-flash' model.

## Architectural Patterns

* **Overall Architecture:** TBD
* **Directory Structure Philosophy:**
    * `/`: The root contains the main Terraform configuration files for the entire project.
    * `/client`: Contains the Next.js client application.


## UI Guidelines
   * **Tables:** All table columns should be sortable and use Server Side sorting. 


## Coding Conventions & Style Guide

* **Formatting:**
    * **Terraform:** Follows standard Terraform formatting. The code is organized into modules for reusability.
    * **Python:** (Inferred) Likely follows PEP 8, but no linter configuration is present.
    * **CSS:** Use tailwindcss.  Do not inline styles unless absolutely necessary.  Do not use inline event handlers.  Use event listeners instead.
    * **Javascript/TypeScript:**  Use modern Javascript/TypeScript.  Do not use jQuery.  Do not use inline event handlers.  Use event listeners instead.
    * **HTML:** Do not use inline styles. Do not use inline event handlers.  Use event listeners instead.
    * **Styling Rules:** Always use the 8pt grid system for all spacing.  This means that all spacing should be in multiples of 8px.  This applies to margins, paddings, and the sizing of elements.

* **Naming Conventions:**
    * **Terraform Resources:** kebab-case (e.g., `google_project.bronze`).
    * **Files:** kebab-case or snake_case.

* **API Design:** TBD

* **Error Handling:** TBD.


## Documentation Ruls
  * **Class Documentation:** Add a description to the top of every class you modify, explaining the purpose of this class and it's job inside the application.   Keep a running list of architectural decisions made in this class OR instructions for the next model session about this class and how it works.
  
  * **Method Documentation:** document every method you modify
  
  * **Code Documentation:** Inside any method, add detailed documentation to
  - each section of the code
  - detailed comments about the logic flow inside a method.  
  
  You may use the following tags:  "// TODO:" to denote sections that need further improvement, "// NOTE:" to denote important information, "// HACK:" to denote a workaround, "// FIXME:" to denote something that is broken.


## Testing guidelines
   * **New Code:** All new code must have detailed unit tests, for 100% code coverage.   Test should include simple conditions, extreme conditions, and failure conditions. 
   * **Regressions:**  Every bug fix must include a unit test that validates the bug fix. So we never have a regression bug.  


## GIT guidelines
   * **GIT Commits**  Never automatically commit code, I want to review changes first. However, if I ask you to commit code, write up a detailed commit message and commit the modified code.
   * **Commit Messages:** 
    * Commit messages should be in the format: `<type>: <subject>`
    * Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`
    * After completing a plan, write up a git commit message explaining all of the changes you made.

   * **Branching Strategy:** 
    * **Mainline:** `main`
    * **Development:** `develop`
    * **Feature Branches:** `feature/<feature-name>`
    * **Hotfix Branches:** `hotfix/<hotfix-name>`
    * **Release Branches:** `release/<release-name>`


## Development & Testing Workflow
   * **Components/Widgets:**. In general nested components on a page, should take properties in and send events up when data is changed.   Avoid two way data binding when possible.   Run all queries at the page level, passing the data into the nested components for rendering.  Instead of having hundreds of components running queries all over the place. 


## Infrastructure as code
   * **Terraform:** Project configuration must be 100% deployed with terraform.   Do not auto-run the terraform, as me to run it after you modify it. 
   * **Security:** Be mindful of security. Do not hardcode secrets or keys. Use the provided Terraform variables for any sensitive information.
   
## Working with AI
   - While working, using tools, thinking, reading files, you are to write out a running narration of what you are doing and why. You must include the user as you work by outputting thoughts and analysis between tool calls.
   - **Model selection**: You are to always use the most powerful model available to you.  Currently, gamini 1.x and 2.x models have been deprecated. do not use these.  Use this model at a minimum "gemini-3.5-flash"