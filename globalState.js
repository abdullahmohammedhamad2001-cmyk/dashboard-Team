"use client";

import React, { createContext, useReducer, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { DB } from "./firebaseConfig";

const GlobalStateContext = createContext();

const initialState = {
  students: [],
  schools: [],
  drivers: [],
  lines: [],
  bills: [],
  loading: true,
  error: null,
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_DATA":
      return {
        ...state,
        ...action.payload,
        loading: false,
      };
    case "ERROR":
      return {
        ...state,
        error: action.error,
        loading: false,
      };
    default:
      return state;
  }
};

export const GlobalStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsSnap, schoolsSnap, driversSnap, linesSnap, teachersSnap, employeesSnap, billsSnap] =
          await Promise.all([
            getDocs(collection(DB, "students")),
            getDocs(collection(DB, "schools")),
            getDocs(collection(DB, "drivers")),
            getDocs(collection(DB, "lines")),
            getDocs(collection(DB, "teachers")),
            getDocs(collection(DB, "employees")),
            getDocs(collection(DB, "student_bills")),
          ]);

        const schools = schoolsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const students = studentsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const teachers = teachersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const employees = employeesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const drivers = driversSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const lines = linesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const bills = billsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        dispatch({
          type: "SET_DATA",
          payload: { students, schools, drivers, lines, teachers, employees, bills }
        });
      } catch (error) {
        dispatch({ type: "ERROR", error });
      }
    };

    fetchData();
  }, []);

  return (
    <GlobalStateContext.Provider value={state}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => React.useContext(GlobalStateContext);