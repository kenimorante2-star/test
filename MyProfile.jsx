// src/pages/MyProfile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth, useUser, SignedIn } from '@clerk/clerk-react';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;// IMPORTANT: Ensure this matches your backend URL

const MyProfile = () => {
    const { userId, getToken, isLoaded: authLoaded, isSignedIn } = useAuth();
    const { user, isLoaded: userLoaded } = useUser(); // Clerk's user object for default first/last name
    const [userProfile, setUserProfile] = useState(null); // This will hold the data from your backend
    const [loading, setLoading] = useState(true);
    const [profileFormError, setProfileFormError] = useState(null);
    const [profileFormSuccess, setProfileFormSuccess] = useState('');

    const [profileFormData, setProfileFormData] = useState({
        // First and Last Name will be populated from Clerk's user object and disabled
        gender: '',
        birthDate: '',
        address: '',
        phoneNumber: '', // New state for phone number
        idPicture: null, // For file input
    });

    // Effect to fetch user profile when component mounts or user data becomes available
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!authLoaded || !userLoaded || !isSignedIn || !userId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            setProfileFormError(null);
            setProfileFormSuccess('');

            try {
                const token = await getToken();
                const response = await axios.get(`${BACKEND_URL}/api/user-profile/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const fetchedProfile = response.data;
                setUserProfile(fetchedProfile);

                let formattedBirthDate = '';
                if (fetchedProfile.birth_date) {
                    // Method 1: Create a Date object from the fetched string, then manually format for YYYY-MM-DD
                    // This avoids timezone issues by not using toISOString
                    const date = new Date(fetchedProfile.birth_date);
                    // Get year, month, day in local time (or the time of the date string if it's plain)
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
                    const day = String(date.getDate()).padStart(2, '0');
                    formattedBirthDate = `${year}-${month}-${day}`;

                    // Method 2 (simpler if the backend consistently sends YYYY-MM-DD string):
                    // formattedBirthDate = fetchedProfile.birth_date; // Use the string directly
                }
                // Pre-fill form data with fetched profile or Clerk user data
                setProfileFormData({
                    // First and Last Name are explicitly not set here from fetchedProfile as they are disabled
                    gender: fetchedProfile.gender || '',
                    birthDate: formattedBirthDate,
                    address: fetchedProfile.address || '',
                    phoneNumber: fetchedProfile.phone_number || '', // Pre-fill with fetched phone number
                    idPicture: null, // Never pre-fill file input
                });
            } catch (err) {
                console.error("Error fetching user profile:", err);
                if (err.response?.status === 404) {
                    // Profile not found in your backend, no specific error, just allow filling
                    setProfileFormError("Your profile details are incomplete. Please fill out the form.");
                } else {
                    setProfileFormError("Failed to load profile details.");
                }
                setUserProfile(null); // Reset profile if error
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [authLoaded, userLoaded, isSignedIn, userId, getToken, user]);


    const handleProfileFormChange = (e) => {
        const { name, value, files } = e.target;
        if (name === 'idPicture') {
            setProfileFormData(prev => ({ ...prev, [name]: files[0] }));
        } else {
            setProfileFormData(prev => ({ ...prev, [name]: value }));
        }
        setProfileFormError(null); // Clear errors on change
        setProfileFormSuccess(''); // Clear success on change
    };

    const handleProfileFormSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setProfileFormError(null);
        setProfileFormSuccess('');

        if (!userId) {
            setProfileFormError("User not logged in. Please sign in to update profile.");
            setLoading(false);
            return;
        }

        const dataToSend = new FormData();
        dataToSend.append('userId', userId); // Ensure userId is sent
        // First and Last Name are NOT sent via this form submit as they are disabled and from Clerk
        dataToSend.append('firstName', user?.firstName || ''); // Get from Clerk user object
        dataToSend.append('lastName', user?.lastName || '');
        dataToSend.append('gender', profileFormData.gender);
        dataToSend.append('birthDate', profileFormData.birthDate);
        dataToSend.append('address', profileFormData.address);
        dataToSend.append('phoneNumber', profileFormData.phoneNumber); // Append the phone number

        // Only append idPicture if a new file is selected
        if (profileFormData.idPicture) {
            dataToSend.append('idPicture', profileFormData.idPicture);
        } else if (!userProfile?.id_picture_url) {
            // If no new ID picture is uploaded AND there's no existing one, show error
            setProfileFormError("Valid ID picture is required.");
            setLoading(false);
            return;
        }


        try {
            const token = await getToken();
            const response = await axios.post(`${BACKEND_URL}/api/user-profile`, dataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data', // Important for file uploads
                    'Authorization': `Bearer ${token}`
                }
            });
            setUserProfile(response.data.profile); // Update local state with new profile data from backend
            setProfileFormSuccess(response.data.message || "Profile updated successfully!");
            // Clear the file input after successful upload to avoid re-uploading on next submit
            setProfileFormData(prev => ({ ...prev, idPicture: null }));

        } catch (err) {
            console.error("Error updating profile:", err.response?.data || err.message);
            setProfileFormError(err.response?.data?.error || "Failed to update profile. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <p className="pt-28 px-4 text-center">Loading profile...</p>;
    if (!isSignedIn) return <p className="pt-28 px-4 text-center text-red-500">Please sign in to view your profile.</p>;

    return (
        <div className="py-28 md:py-35 px-4 md:px-16 lg:px-24 xl:px-32">
            <h1 className="text-3xl md:text-4xl font-playfair mb-8 text-center">My Personal Profile</h1>

            <div className="mt-10 p-6 bg-white shadow-[0px_0px_20px_rgba(0,0,0,0.1)] rounded-xl max-w-2xl mx-auto">
                <p className="text-gray-600 mb-6 text-center">
                    Manage your personal details and ensure your information is up-to-date for seamless bookings.
                </p>
                <form onSubmit={handleProfileFormSubmit} className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 flex flex-col">
                            <label htmlFor="firstName" className="font-medium">First Name</label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={user?.firstName || ''}
                                className="rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none bg-gray-100 cursor-not-allowed"
                                disabled // <--- DISABLED HERE
                            />
                        </div>
                        <div className="flex-1 flex flex-col">
                            <label htmlFor="lastName" className="font-medium">Last Name</label>
                            <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                value={user?.lastName || ''}
                                className="rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none bg-gray-100 cursor-not-allowed"
                                disabled // <--- DISABLED HERE
                            />
                        </div>
                    </div>
                    {/* Add the phone number field here */}
                    <div className="flex flex-col">
                        <label htmlFor="phoneNumber" className="font-medium">Phone Number</label>
                        <input
                            type="tel"
                            id="phoneNumber"
                            name="phoneNumber"
                            value={profileFormData.phoneNumber}
                            onChange={handleProfileFormChange}
                            className="rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none"
                            required
                        />
                    </div>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 flex flex-col">
                            <label htmlFor="gender" className="font-medium">Gender</label>
                            <select
                                id="gender"
                                name="gender"
                                value={profileFormData.gender}
                                onChange={handleProfileFormChange}
                                className="rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none"
                                required
                            >
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="flex-1 flex flex-col">
                            <label htmlFor="birthDate" className="font-medium">Birth Date</label>
                            <input
                                type="date"
                                id="birthDate"
                                name="birthDate"
                                value={profileFormData.birthDate}
                                onChange={handleProfileFormChange}
                                className="rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label htmlFor="address" className="font-medium">Address</label>
                        <textarea
                            id="address"
                            name="address"
                            value={profileFormData.address}
                            onChange={handleProfileFormChange}
                            className="rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none"
                            rows="3"
                            required
                        ></textarea>
                    </div>

                    <div className="flex flex-col">
                        <label htmlFor="idPicture" className="font-medium">Valid ID Picture (Passport, Driver's License, etc.)</label>
                        <input
                            type="file"
                            id="idPicture"
                            name="idPicture"
                            accept="image/*,.pdf" // Allow images and PDFs
                            onChange={handleProfileFormChange}
                            className="rounded border border-gray-300 px-3 py-2 mt-1.5 outline-none"
                            // If userProfile?.id_picture_url exists, it's not required; otherwise, it is.
                            required={!userProfile?.id_picture_url} // <--- CORRECTED LOGIC FOR REQUIRED
                        />
                        {userProfile?.id_picture_url && (
                            <p className="text-sm text-gray-500 mt-1">
                                Current ID: <a href={`${BACKEND_URL}${userProfile.id_picture_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View Current ID</a> (Upload new to replace)
                            </p>
                        )}
                        {!userProfile?.id_picture_url && (
                            <p className="text-sm text-red-500 mt-1">Valid ID is required for bookings.</p>
                        )}
                    </div>

                    {profileFormError && (
                        <p className="text-red-600 text-sm text-center">{profileFormError}</p>
                    )}
                    {profileFormSuccess && (
                        <p className="text-green-600 text-sm text-center">{profileFormSuccess}</p>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary-dull active:scale-95 transition-all text-white rounded-md py-3 text-base cursor-pointer"
                        disabled={loading}
                    >
                        {loading ? 'Saving Profile...' : 'Save Profile Details'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default MyProfile;
