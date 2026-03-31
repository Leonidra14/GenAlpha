import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./RoleSelect.css";

import logo from "../assets/logo.png";
import teacherImg from "../assets/teacher.png";
import studentImg from "../assets/student.png";

import clouds from "../assets/clouds.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";
import labs from "../assets/lab_books.png";
import robot from "../assets/waving_robot.png"; 

function mulberry32(seed) {
  // deterministická "random" funkce (aby se to neměnilo při každém renderu)
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function RoleSelect() {
  const nav = useNavigate();

  const decos = useMemo(() => {
    const rand = mulberry32(42);
    const items = [];

    const addMany = (count, type) => {
      for (let i = 0; i < count; i++) {
        const left = `${Math.round(rand() * 100)}%`;
        const top = `${Math.round(rand() * 85)}%`; 
        const scale = 0.6 + rand() * 0.9; 
        const rotate = Math.round((rand() * 24 - 12) * 10) / 10; 
        const opacity = 0.18 + rand() * 0.35;
        const blur = rand() < 0.25 ? 0.6 : 0; 

        const src = type === "star" ? star : flight;
        items.push({
          id: `${type}-${i}`,
          type,
          src,
          style: {
            left,
            top,
            transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
            opacity,
            filter: blur ? `blur(${blur}px)` : "none",
          },
        });
      }
    };

    addMany(30, "star");    
    addMany(10, "flight");   

    return items;
  }, []);

  return (
    <div className="rolePage">
      {/* pozadí / velké dekorace */}
      <img className="dec decClouds" src={clouds} alt="" aria-hidden="true" />
      <img className="dec decLabs" src={labs} alt="" aria-hidden="true" />
      <img className="dec decRobot" src={robot} alt="" aria-hidden="true" />

      {/* náhodné dekorace */}
      {decos.map((d) => (
        <img
          key={d.id}
          className={`dec decRand ${d.type === "flight" ? "decRandFlight" : ""}`}
          src={d.src}
          alt=""
          aria-hidden="true"
          style={d.style}
        />
      ))}

      <div className="roleWrap">
        
        <img className="roleLogo" src={logo} alt="GenAlpha" />
        <h2 className="roleTitle">Kdo jsi?</h2>
        <p className="roleSubtitle">
          Vyber si svou roli, abychom tě přesměrovali dál.
        </p>

        <div className="roleGrid">
          <div className="roleCard">
            <div className="roleCardTop">
              <img className="roleCardImg" src={teacherImg} alt="" aria-hidden="true" />
            </div>
            <div className="roleCardBody">
              <div className="roleCardHeading">Učitel</div>
              <div className="roleCardDesc">Pro učitele a vyučující</div>

              <button className="roleBtn primary" onClick={() => nav("/teacher/login")}>
                Učitel
              </button>
            </div>
          </div>

          <div className="roleCard roleCard">
            <div className="roleCardTop">
              <img className="roleCardImg" src={studentImg} alt="" aria-hidden="true" />
            </div>
            <div className="roleCardBody">
              <div className="roleCardHeading">Žák</div>
              <div className="roleCardDesc">Pro žáky a studenty</div>

              <button className="roleBtn primary" onClick={() => nav("/student/login")}>
                Student
              </button>

            </div>
          </div>
        </div>
      </div>

      
    </div>
  );
}
