# **StarBright**

StarBright is a mobile web app that allows users to manage sky quality measurements and search for the best star viewing locations nearby. It may appeal to groups interested in raising awareness about light pollution and/or stargazers seeking better sky conditions.

### **Login**

Management of user accounts is deferred to Google. Any user who is authenticated by Google is authorized to use StarBright.

![starbright-login](https://cloud.githubusercontent.com/assets/8960984/11848942/93457d5a-a3e2-11e5-94b6-83fef2167868.gif)

### **Sky Quality Measurement**

Sky brightness is measured in terms of magnitudes per arcsecond squared. Users with access to specialized equipment may choose to input measurements manually. Alternatively, an interactive visualization of the night sky is provided to assist users to estimating sky brightness values. It renders the sky as a user would see currently from his/her geolocation. The idea is that a user can make adjustments to the simulation until converging on a decent approximation of the actual sky.

![starbright-measure](https://cloud.githubusercontent.com/assets/8960984/11848969/a7015b52-a3e2-11e5-90bb-ecb8ea9a673f.gif)

### **Submission History**

Each user may review and edit a personal log of submitted sky quality measurements. It is possible to update, revert, and delete measurements. Updates to sky brightness values are constrained to the range [12, 21], as this encompasses all ~5000 stars that are visible with natural human vision.

![starbright-view](https://cloud.githubusercontent.com/assets/8960984/11848976/afce27ce-a3e2-11e5-879a-e3855add8029.gif)

### **Sky Quality Search**

A user can search for the best stargazing locations within a certain distance of his/her current position. Locations are ranked by average sky brightness, which is calculated from submissions by all users.

![starbright-search](https://cloud.githubusercontent.com/assets/8960984/11848995/bc75a812-a3e2-11e5-921e-7375e6ecc301.gif)