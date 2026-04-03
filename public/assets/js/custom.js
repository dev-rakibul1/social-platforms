/*-----Custom JS Dark Mode For Feed01 ------*/
(() => {
  const toggleMode = document.querySelector("._layout_swithing_btn_link");
  const layout = document.querySelector("._layout_main_wrapper");

  if (toggleMode && layout) {
    let darkMode = false;
    toggleMode.addEventListener("click", () => {
      darkMode = !darkMode;
      if (darkMode) {
        layout.classList.add("_dark_wrapper");
      } else {
        layout.classList.remove("_dark_wrapper");
      }
    });
  }
/*-----Custom JS Dark Mode End For Feed01 ------*/
// Custom Dropdown for profile
  var profileDropdown = document.querySelector("#_prfoile_drop");
  var profileDropShowBtn = document.querySelector("#_profile_drop_show_btn");
  var isDropShow = false;

  if (profileDropdown && profileDropShowBtn) {
    profileDropShowBtn.addEventListener("click", function () {
      isDropShow = !isDropShow;
      if (isDropShow) {
        profileDropdown.classList.add("show");
      } else {
        profileDropdown.classList.remove("show");
      }
    });
  }

// Custom Dropdown for profile

//Custom Dropdown for timeline
  var timelineDropdown = document.querySelector("#_timeline_drop");
  var timelineDropShowBtn = document.querySelector("#_timeline_show_drop_btn");
  var isDropTimelineShow = false;

  if (timelineDropdown && timelineDropShowBtn) {
    timelineDropShowBtn.addEventListener("click", function () {
      isDropTimelineShow = !isDropTimelineShow;
      if (isDropTimelineShow) {
        timelineDropdown.classList.add("show");
      } else {
        timelineDropdown.classList.remove("show");
      }
    });
  }
//Custom Dropdown for timeline
})();
