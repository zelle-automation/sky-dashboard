// Runs before paint so a pinned dashboard theme never flashes the other one.
export const THEME_KEY = "sky-admin-theme";
export const adminThemeInit = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
