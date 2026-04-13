import React from "react";
import AppTopbar from "./AppTopbar";
import AppBackgroundDecor from "./AppBackgroundDecor";
import { useRandomDecorations } from "../../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../../constants/backgroundDecorPresets";

import clouds from "../../assets/clouds.png";
import labs from "../../assets/lab_books.png";
import star from "../../assets/star.png";
import flight from "../../assets/flight.png";

export default function ClassListPageLayout({ onLogout, title, error, children }) {
  const randomDecos = useRandomDecorations({
    ...backgroundDecorPresets.mainList,
    starSrc: star,
    flightSrc: flight,
  });

  return (
    <div className="tmainPage">
      <AppBackgroundDecor
        cloudsSrc={clouds}
        labsSrc={labs}
        randomDecos={randomDecos}
        cloudsClassName="tmainDec tmainClouds"
        labsClassName="tmainDec tmainLabs"
        randomBaseClassName="tmainDec tmainRand"
        randomFlightClassName="tmainRandFlight"
        randomStarClassName="tmainRandStar"
      />

      <div className="tmainWrap">
        <AppTopbar
          onLogout={onLogout}
          topbarClassName="tmainTopbar"
          logoClassName="tmainLogo"
          actionsClassName="tmainTopActions"
          logoutButtonClassName="tmainLogout tcdBtn"
        />

        <div className="tmainHeader">
          <h1 className="tmainPageTitle">{title}</h1>
        </div>

        {error && <div className="tmainError">{error}</div>}

        {children}
      </div>
    </div>
  );
}
