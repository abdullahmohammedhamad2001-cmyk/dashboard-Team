"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ClipLoader from "react-spinners/ClipLoader";
import { supabase } from "../supabaseClient";
import {MdDashboard,MdPeople,MdDirectionsBus,MdRoute,MdSchool,MdViewCarousel,MdBusinessCenter,MdChevronLeft,MdChevronRight} from "react-icons/md";
import './style.css';
import Image from 'next/image'
import logo from '../images/notification-icon.png'

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
      } else {
        setIsAuthenticated(true);
      }
    });
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="loader-container">
        <ClipLoader color="#8a6115" size={50} />
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
      <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <Image
            src={logo}
            width={54}
            height={54}
            alt='شعار لوحة تحكم التيم'
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
                title={link.label}
              >
                <Icon size={18} />
                {!isSidebarCollapsed && link.label}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          title={isSidebarCollapsed ? "فتح القائمة" : "طي القائمة"}
        >
          {isSidebarCollapsed ? <MdChevronLeft size={20} /> : <MdChevronRight size={20} />}
        </button>
      </aside>

      {/* Main */}
      <main className={`main-content ${isSidebarCollapsed ? "expanded" : ""}`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;