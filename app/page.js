"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ClipLoader from "react-spinners/ClipLoader";
import {MdDashboard,MdPeople,MdDirectionsBus,MdRoute,MdSchool,MdViewCarousel,MdBusinessCenter} from "react-icons/md";
import './style.css';
import Image from 'next/image'
import logo from '../images/logo.png'

// Components
import Main from "../components/main";
import Lines from "../components/lines";
import Students from "../components/students";
import Drivers from "../components/drivers";
import Schools from "../components/schools";
import Carousel from "../components/carousel";
import Crm from "../components/crm";

const Dashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState("الرئيسية");
  const router = useRouter();

  useEffect(() => {
    const adminLoggedIn = localStorage.getItem("adminLoggedIn");
    if (!adminLoggedIn) {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="loader-container">
        <ClipLoader color="#3b82f6" size={50} />
      </div>
    );
  }

  const links = [
    { label: "الرئيسية", icon: MdDashboard },
    { label: "الطلاب", icon: MdPeople },
    { label: "المدارس", icon: MdSchool },
    { label: "السواق", icon: MdDirectionsBus },
    { label: "الخطوط", icon: MdRoute },
    { label: "الكارسول العام", icon: MdViewCarousel },
    { label: "CRM", icon: MdBusinessCenter },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "الرئيسية":
        return <Main />;
      case "الطلاب":
        return <Students />;
      case "المدارس":
        return <Schools />;
      case "السواق":
        return <Drivers />;
      case "الخطوط":
        return <Lines />;
      case "الكارسول العام":
        return <Carousel />;
      case "CRM":
        return <Crm />;
      default:
        return <Main />;
    }
  };

  return (
    <div className="dashboard-container">

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Image
            src={logo}
            width={50}
            height={50}
            alt='logo image'
            style={{objectFit:'contain'}}
          />
        </div>

        <div className="sidebar-links">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = activeSection === link.label;

            return (
              <div
                key={link.label}
                onClick={() => setActiveSection(link.label)}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <Icon size={18} />
                {link.label}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;