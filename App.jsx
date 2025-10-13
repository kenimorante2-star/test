// App.jsx
import React, { useState, useEffect, useCallback } from 'react'; // Ensure useState, useEffect, useCallback are imported
import './index.css';
import 'react-day-picker/dist/style.css';
import Navbar from './components/Navbar';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SignedIn, useUser } from '@clerk/clerk-react';
import Home from './pages/Home';
import Footer from './components/Footer';
import AllRooms from './pages/AllRooms';
import RoomDetails from './pages/RoomDetails';
import MyBookings from './pages/MyBookings';
import Layout from './pages/hotelOwner/Layout';
import Dashboard from './pages/hotelOwner/Dashboard';
import PhysicalRoom from './pages/hotelOwner/PhysicalRooms';
import ListRoom from './pages/hotelOwner/ListRoom';
import EditRoom from './pages/hotelOwner/EditRoom';
import MyProfile from './pages/MyProfile';
import WalkInBooking from './pages/hotelOwner/WalkInBooking';
import Testimonial from './components/Testimonial'; 
import FeedbacksPage from './pages/FeedbacksPage'; 
import AboutUs from './pages/AboutUs';
import History from './pages/hotelOwner/History';

// --- Modal Component (moved here for global access and consistency) ---
// This Modal component is directly within App.jsx to be managed by App's state
const Modal = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
        <p className="text-lg font-semibold text-gray-800">{message}</p>
        <button
          onClick={onClose}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300"
        >
          OK
        </button>
      </div>
    </div>
  );
};


const App = () => {
  const isOwnerPath = useLocation().pathname.includes("owner");
  const { user, isLoaded, isSignedIn } = useUser();
  const navigate = useNavigate();

  // State and functions for the global modal
  const [modalMessage, setModalMessage] = useState(null);

  const showModal = useCallback((message) => {
    setModalMessage(message);
  }, []);

  const closeModal = () => {
    setModalMessage(null);
  };

  // Check if the user is an admin
  const isAdmin = isLoaded && isSignedIn && user?.publicMetadata?.role === 'admin';

  // Use useEffect to handle redirections for owner paths
  useEffect(() => {
    if (isLoaded && isOwnerPath) { // Only run this effect if Clerk is loaded and we are on an owner path
      if (!isAdmin) { // If not an admin
        if (isSignedIn) {
          // If signed in but not admin, redirect to a different page (e.g., home or a specific dashboard)
          navigate('/'); // Redirect to home or another appropriate page for non-admins
        } else {
          // If not signed in, redirect to the Clerk sign-in page
          navigate('/sign-in'); // Assuming you have a /sign-in route for Clerk
        }
      }
    }
  }, [isLoaded, isAdmin, isSignedIn, isOwnerPath, navigate]); // Dependencies for useEffect

  return (
    <div>
      {/* Conditionally render Navbar based on path */}
      {!isOwnerPath && <Navbar />}

      <div className='min-h-[70vh]'>
        <Routes>
          {/* Main Public Routes */}
          <Route path='/' element={<Home />} />
          <Route path='/rooms' element={<AllRooms />} />
          <Route path='/rooms/:id' element={<RoomDetails />} />

          {/* New Testimonial and Feedbacks Routes */}
          {/* Place Testimonial on a specific route, e.g., '/testimonials' */}
          {/* IMPORTANT: If you want testimonials on the home page, you'd render Testimonial directly in the Home component,
              or adjust the Home route to also include Testimonial. For now, assuming a dedicated route. */}
          <Route path='/testimonials' element={<Testimonial showModal={showModal} />} />
          {/* FeedbacksPage component to display all testimonials */}
          <Route path='/feedbacks' element={<FeedbacksPage showModal={showModal} />} />
          <Route path="/about" element={<AboutUs />} />


          {/* Authenticated User Routes */}
          <Route path='/my-bookings' element={
            <SignedIn>
              <MyBookings />
            </SignedIn>
          } />

          <Route path='/my-profile' element={
            <SignedIn>
              <MyProfile />
            </SignedIn>
          } />

          {/* Hotel Owner Routes (Nested Routes) */}
          {/* Ensure Layout is rendered only if the user is an admin */}
          <Route path='/owner' element={
            isLoaded && isAdmin ? <Layout /> : null
          }>
            <Route index element={<Dashboard />} />
            <Route path="physical-room" element={<PhysicalRoom />} />
            <Route path="list-room" element={<ListRoom />} />
            <Route path="edit-room/:id" element={<EditRoom />} />
            <Route path="walk-in-booking" element={<WalkInBooking />} />
            <Route path="history" element={<History />} />
          </Route>

          {/* You might want to add a catch-all 404 route for unmatched paths */}
          {/* <Route path="*" element={<NotFoundPage />} /> */}

        </Routes>
      </div>

      {/* Footer is always rendered */}
      <Footer />

      {/* Global Modal Component - accessible by all routes */}
      <Modal message={modalMessage} onClose={closeModal} />
    </div>
  );
};

export default App;