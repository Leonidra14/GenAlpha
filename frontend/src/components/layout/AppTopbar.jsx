import React from "react";
import logo from "../../assets/logo.png";

export default function AppTopbar({
  onLogout,
  actions = null,
  topbarClassName,
  logoClassName,
  actionsClassName,
  logoutButtonClassName,
  logoutText = "⟶ Odhlásit se",
}) {
  return (
    <div className={topbarClassName}>
      <img className={logoClassName} src={logo} alt="GenAlpha" />
      <div className={actionsClassName}>
        {actions}
        <button className={logoutButtonClassName} onClick={onLogout}>
          {logoutText}
        </button>
      </div>
    </div>
  );
}
