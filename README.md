# Project Athena

This GitHub Pages build runs the Athena review app in a browser. Start a new analysis and add a CSV or choose the built-in Happy or Stress samples in Account Configuration and Data Workspace. To load a whole sample at once, use the injector under Settings. Run the analysis from the Analysis Cockpit.

The site uses the Athena 26 November 2026 checkpoint (source commit 87243f3) and Pyodide 314.0.8. The browser serves the same Python request handlers through an in-memory worker. The browser runtime uses scikit-learn 1.8.0. Desktop Chrome is the verified browser. Browsers that use the dedicated worker fallback may require uploading the file again after a refresh.

Explore and Threshold Guides open beside their own buttons in anchored, non-modal popups without dimming the surrounding view, including in Focus.
