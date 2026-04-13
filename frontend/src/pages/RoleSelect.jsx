import React from "react";
import { useNavigate } from "react-router-dom";
import "./RoleSelect.css";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../constants/backgroundDecorPresets";

import logo from "../assets/logo.png";
import teacherImg from "../assets/teacher.png";
import studentImg from "../assets/student.png";

import clouds from "../assets/clouds.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";
import labs from "../assets/lab_books.png";
import robot from "../assets/waving_robot.png"; 

export default function RoleSelect() {
  const nav = useNavigate();

  const decos = useRandomDecorations({
    ...backgroundDecorPresets.roleSelect,
    starSrc: star,
    flightSrc: flight,
  });

  return (
    <div className="rolePage">
      <AppBackgroundDecor
        cloudsSrc={clouds}
        labsSrc={labs}
        randomDecos={decos}
        extraDecos={[{ id: "robot", src: robot, className: "dec decRobot" }]}
        cloudsClassName="dec decClouds"
        labsClassName="dec decLabs"
        randomBaseClassName="dec decRand"
        randomFlightClassName="decRandFlight"
        randomStarClassName=""
      />

      <div className="roleWrap">
        
        <img className="roleLogo" src={logo} alt="GenAlpha" />
        <h2 className="roleTitle">Kdo jsi?</h2>

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

          <div className="roleCard">
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
