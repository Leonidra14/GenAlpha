import React from "react";

export default function AppBackgroundDecor({
  cloudsSrc,
  labsSrc,
  randomDecos = [],
  extraDecos = [],
  cloudsClassName,
  labsClassName,
  randomBaseClassName,
  randomFlightClassName,
  randomStarClassName,
}) {
  return (
    <>
      <img className={cloudsClassName} src={cloudsSrc} alt="" aria-hidden="true" />
      {randomDecos.map((d) => (
        <img
          key={d.id}
          className={`${randomBaseClassName} ${
            d.type === "flight" ? randomFlightClassName : randomStarClassName
          }`}
          src={d.src}
          alt=""
          aria-hidden="true"
          style={d.style}
        />
      ))}
      {extraDecos.map((d) => (
        <img
          key={d.id}
          className={d.className}
          src={d.src}
          alt=""
          aria-hidden="true"
          style={d.style}
        />
      ))}
      <img className={labsClassName} src={labsSrc} alt="" aria-hidden="true" />
    </>
  );
}
