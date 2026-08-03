"use client"
import React,{useState} from 'react'
import '../style.css'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where } from "firebase/firestore"
import { DB } from '../../firebaseConfig'
import ClipLoader from "react-spinners/ClipLoader"
import Image from 'next/image'
import logo_image from '../../images/notification-icon.png'

const Login = () => {
  const [username,setUsername] = useState('')
  const [password,setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading,setLoading] = useState(false)

  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Query Firestore for admin credentials
      const q = query(
        collection(DB, "admins"),
        where("username", "==", username),
        where("password", "==", password)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();     

        localStorage.setItem('adminLoggedIn', true)
        localStorage.setItem('adminDahboardName', userData.dashboard_name)

        setTimeout(() => {
          router.push("/");
        }, 300);

      } else {
        setError('يرجى التثبت من المعلومات المدرجة')
      }
    } catch (err) {
      setError('يرجى التثبت من المعلومات المدرجة')
    }finally {
      setLoading(false)
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Image
            src={logo_image}
            width={88}
            height={88}
            alt="شعار لوحة تحكم التيم"
          />
        </div>

        <h2 className="login-title">تسجيل الدخول</h2>

        {error && <p className="login-error">{error}</p>}

        <form className="login-form" onSubmit={handleLogin}>
          <input
            placeholder="اسم المستخدم"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            placeholder="كلمة المرور"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {loading ? (
            <div className="login-btn loading">
              <ClipLoader size={14} color="#fff" />
            </div>
          ) : (
            <button type="submit" className="login-btn">
             دخول
            </button>
          )}
        </form>
      </div>

      {loading && (
        <div className="page-loading-overlay">
          <ClipLoader size={40} color="#000" />
          <p>جاري تسجيل الدخول...</p>
        </div>
      )}
    </div>
  );
}

export default Login

/*
        <div className="login-footer">
          <p>تريد مسح حسابك؟</p>
          <Link href="/delete-account">اضغط هنا</Link>
        </div>
*/
