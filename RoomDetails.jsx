// src/pages/User/RoomDetails.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';
import { assets, facilityIcons } from '../assets/assets';
import StarRating from '../components/StarRating';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import '../styles/calendar.css';

// Import startOfDay for robust date normalization
import { eachDayOfInterval, format, differenceInDays, startOfDay } from 'date-fns';


const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const RoomDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { userId, isLoaded, isSignedIn, getToken } = useAuth();
    const { user } = useUser();
    const { openSignIn } = useClerk();

    const [room, setRoom] = useState(null);
    const [mainImage, setMainImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Initialize selectedCheckInDate to undefined to allow user to select it
    const [selectedCheckInDate, setSelectedCheckInDate] = useState(undefined);
    const [selectedCheckOutDate, setSelectedCheckOutDate] = useState(undefined);
    const [guests, setGuests] = useState(1);
    const [actualCheckInTimeInput, setActualCheckInTimeInput] = useState('');

    const [calculatedTotalPrice, setCalculatedTotalPrice] = useState(0);
    const [bookingProcessing, setBookingProcessing] = useState(false);
    const [bookingSuccessMessage, setBookingSuccessMessage] = useState('');
    const [bookingError, setBookingError] = useState(null);

    const [showProfileForm, setShowProfileForm] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [isProfileLoading, setIsProfileLoading] = useState(true);
    const [profileFormData, setProfileFormData] = useState({
        firstName: '',
        lastName: '',
        gender: '',
        birthDate: '',
        address: '',
        phoneNumber: '',
        idPicture: null,
    });
    const [profileFormError, setProfileFormError] = useState(null);
    const [profileFormSuccess, setProfileFormSuccess] = useState('');

    const [isAvailableForDates, setIsAvailableForDates] = useState(false);
    const [availabilityMessage, setAvailabilityMessage] = useState('');
    const [checkingAvailability, setCheckingAvailability] = useState(false);

    const [bookedDates, setBookedDates] = useState([]);
    const [hasPhysicalRooms, setHasPhysicalRooms] = useState(true);
    // NEW: State to store the count of physical rooms for this room type
    const [physicalRoomCount, setPhysicalRoomCount] = useState(0);
    const [reviews, setReviews] = useState([]);
    const [showAllReviews, setShowAllReviews] = useState(false); 

    const fetchRoomDetailsAndReviews = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const config = { headers: { Authorization: `Bearer ${token}` } };

            // Fetch room details (assuming room.id is the roomTypeId for fetching reviews)
            const roomRes = await axios.get(`${BACKEND_URL}/rooms/${id}`, config);
            setRoom(roomRes.data);

            // Fetch reviews for this room type
            // Note: The /api/rooms/:roomTypeId/reviews endpoint created in server.js
            // does not require authentication if it's meant for public viewing.
            // If it needs authentication, pass `config` here.
            const reviewsRes = await axios.get(`${BACKEND_URL}/rooms/${id}/reviews`);
            setReviews(reviewsRes.data);

        } catch (err) {
            console.error('Error fetching room details or reviews:', err);
            setError(err.response?.data?.error || 'Failed to fetch room details or reviews.');
        } finally {
            setLoading(false);
        }
    }, [id, getToken]); // Add getToken to dependencies if reviews endpoint requires auth

    useEffect(() => {
        fetchRoomDetailsAndReviews();
    }, [fetchRoomDetailsAndReviews]);

    const latestReview = reviews.length > 0 ? reviews[0] : null;

    useEffect(() => {
        if (bookingSuccessMessage || bookingError || profileFormSuccess || profileFormError || availabilityMessage) {
            const timer = setTimeout(() => {
                setBookingSuccessMessage('');
                setBookingError(null);
                setAvailabilityMessage('');
                setProfileFormSuccess('');
                setProfileFormError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [bookingSuccessMessage, bookingError, profileFormSuccess, profileFormError, availabilityMessage]);

    // Set actualCheckInTimeInput to current time and make it non-editable
    useEffect(() => {
        const now = new Date();
        // Adjust for Philippine time (UTC+8)
        const philippineTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const hours = philippineTime.getUTCHours().toString().padStart(2, '0');
        const minutes = philippineTime.getUTCMinutes().toString().padStart(2, '0');
        setActualCheckInTimeInput(`${hours}:${minutes}`);
    }, []);


    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true); // Start loading

                // Fetch room details and ratings summary concurrently
                const [roomResponse, ratingsResponse] = await Promise.all([
                    axios.get(`${BACKEND_URL}/rooms/${id}`),
                    axios.get(`${BACKEND_URL}/room-ratings-summary`) // NEW: Fetch ratings summary
                ]);

                const fetchedRoom = roomResponse.data;
                const fetchedRatingsSummary = ratingsResponse.data; // This will be an object like { '1': {averageRating: 4.5, reviewCount: 10}, '2': {...} }

                // Combine room data with ratings data
                const roomRatingInfo = fetchedRatingsSummary[fetchedRoom.id] || { averageRating: 0, reviewCount: 0 };
                const roomWithRatings = {
                    ...fetchedRoom,
                    averageRating: parseFloat(roomRatingInfo.averageRating), // Ensure it's a number
                    reviewCount: parseInt(roomRatingInfo.reviewCount, 10)     // Ensure it's an integer
                };
                setRoom(roomWithRatings); // Set the room state with combined data

                if (fetchedRoom.images && fetchedRoom.images.length > 0) {
                    const firstImageUrl = fetchedRoom.images[0];
                    setMainImage(firstImageUrl);
                } else {
                    // Assuming assets.placeholderRoomImage is defined elsewhere for default image
                    setMainImage(assets.placeholderRoomImage);
                }
                // NEW: Fetch the count of physical rooms for this room type
                const physicalRoomCountResponse = await axios.get(`${BACKEND_URL}/physical-rooms/count/${id}`);
                const totalPhysicalRooms = physicalRoomCountResponse.data.count;
                setPhysicalRoomCount(totalPhysicalRooms);
                setHasPhysicalRooms(totalPhysicalRooms > 0);

                // Fetch all bookings for this room type
                const bookingsResponse = await axios.get(`${BACKEND_URL}/bookings/room/${id}`);
                const bookingsData = bookingsResponse.data;

                const dailyBookedCounts = new Map(); // Map to store 'YYYY-MM-DD' -> count of physical rooms booked on that day

                bookingsData.forEach(booking => {
                    // Normalize check-in and check-out dates from booking
                    const checkIn = startOfDay(new Date(booking.checkInDateAndTime)); // Use checkInDateAndTime
                    const checkOut = startOfDay(new Date(booking.checkOutDateAndTime)); // Use checkOutDateAndTime

                    // Get all days within the booking interval (inclusive of check-in, exclusive of check-out for night calculation,
                    // but for marking booked days, include all full days booked)
                    const daysInInterval = eachDayOfInterval({ start: checkIn, end: checkOut });

                    daysInInterval.forEach(day => {
                        const dayString = format(day, 'yyyy-MM-dd');
                        dailyBookedCounts.set(dayString, (dailyBookedCounts.get(dayString) || 0) + 1);
                    });
                });

                const fullyBookedDays = [];
                // Only mark a day as fully booked if the number of bookings on that day
                // equals or exceeds the total number of physical rooms for this type,
                // AND there are actual physical rooms to begin with.
                dailyBookedCounts.forEach((count, dayString) => {
                    if (totalPhysicalRooms > 0 && count >= totalPhysicalRooms) {
                        fullyBookedDays.push(new Date(dayString));
                    }
                });
                setBookedDates(fullyBookedDays);

            } catch (err) {
                console.error("Error fetching room details or bookings:", err);
                setError(err.message || 'Failed to fetch room details or bookings.');
            } finally {
                setLoading(false); // End loading
            }
        };

        fetchData();
    }, [id]);

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!isLoaded || !isSignedIn || !userId) {
                setIsProfileLoading(false);
                setUserProfile(null);
                return;
            }

            setIsProfileLoading(true);
            try {
                const token = await getToken();
                if (!token) {
                    console.warn("No token available for fetching user profile.");
                    setIsProfileLoading(false);
                    return;
                }

                const response = await axios.get(`${BACKEND_URL}/api/user-profile/${userId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                setUserProfile(response.data);
                setProfileFormData(prev => ({
                    ...prev,
                    firstName: response.data.first_name || user?.firstName || '',
                    lastName: response.data.last_name || user?.lastName || '',
                    gender: response.data.gender || '',
                    birthDate: response.data.birth_date ? new Date(response.data.birth_date).toISOString().split('T')[0] : '',
                    address: response.data.address || '',
                    idPicture: null,
                }));
            } catch (err) {
                console.error('Error fetching user profile:', err);
                if (err.response && err.response.status === 404) {
                    setUserProfile(null);
                    setProfileFormData(prev => ({
                        ...prev,
                        firstName: user?.firstName || '',
                        lastName: user?.lastName || '',
                    }));
                } else if (err.response?.status === 401 || err.response?.status === 403) {
                    setProfileFormError('Authentication error fetching profile. Please log in again.');
                } else {
                    setProfileFormError('Failed to load user profile.');
                }
            } finally {
                setIsProfileLoading(false);
            }
        };
        fetchUserProfile();
    }, [isLoaded, isSignedIn, userId, user, getToken]);


    const calculateBookingPrice = useCallback(() => {
        if (!room || !selectedCheckInDate || !selectedCheckOutDate) {
            setCalculatedTotalPrice(0);
            return;
        }

        // Ensure dates are normalized to start of day for consistent calculations
        const checkInDateObj = startOfDay(selectedCheckInDate);
        const checkOutDateObj = startOfDay(selectedCheckOutDate);

        // Ensure check-out is strictly after check-in for valid calculation
        if (checkOutDateObj <= checkInDateObj) {
            setCalculatedTotalPrice(0);
            return;
        }

        const numberOfNights = differenceInDays(checkOutDateObj, checkInDateObj);
        let basePrice = numberOfNights * room.pricePerNight;

        const finalCalculatedTotal = basePrice;
        setCalculatedTotalPrice(finalCalculatedTotal);


    }, [room, selectedCheckInDate, selectedCheckOutDate]);

    useEffect(() => {
        calculateBookingPrice();
    }, [calculateBookingPrice]);


    useEffect(() => {
        const debounceCheck = setTimeout(() => {
            handleCheckAvailability();
        }, 500);

        return () => clearTimeout(debounceCheck);
    }, [selectedCheckInDate, selectedCheckOutDate, guests, room]);

    const handleCheckAvailability = async (e) => {
        if (e) e.preventDefault();

        setCheckingAvailability(true);
        setIsAvailableForDates(false);
        setAvailabilityMessage('');
        setBookingError(null);
        setBookingSuccessMessage('');

        if (!hasPhysicalRooms) {
            setAvailabilityMessage('No rooms are available for this room type. Booking is not possible.');
            setCheckingAvailability(false);
            setIsAvailableForDates(false);
            return; // Stop further checks
        }
        if (!room) {
            setAvailabilityMessage('Room data not loaded yet. Please wait.');
            setCheckingAvailability(false);
            return;
        }

        if (!selectedCheckInDate || !selectedCheckOutDate || guests < 1) {
            setAvailabilityMessage('Please select check-in and check-out dates and number of guests.');
            setCheckingAvailability(false);
            return;
        }

        // Normalize dates for API call
        const checkIn = format(selectedCheckInDate, 'yyyy-MM-dd');
        const checkOut = format(selectedCheckOutDate, 'yyyy-MM-dd');

        if (new Date(checkOut) <= new Date(checkIn)) {
            setAvailabilityMessage('Check-out date must be after check-in date.');
            setCheckingAvailability(false);
            return;
        }

        if (guests > room.maxGuests) {
            setAvailabilityMessage(`This room can only accommodate a maximum of ${room.maxGuests} guests.`);
            setCheckingAvailability(false);
            setIsAvailableForDates(false);
            return;
        }

        try {
            const response = await axios.post(`${BACKEND_URL}/check-availability`, {
                roomId: room.id,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                guests: guests
            });

            if (response.data.available) {
                setIsAvailableForDates(true);
                setAvailabilityMessage(response.data.message || `Room is available!`);
            } else {
                setIsAvailableForDates(false);
                setAvailabilityMessage(response.data.message || `Room is not available for these dates.`);
            }
        } catch (err) {
            console.error('Frontend error checking availability:', err.response?.data || err.message);
            const msg = err.response?.data?.message || 'Error checking availability. Please try again.';
            setAvailabilityMessage(msg);
            setIsAvailableForDates(false);
        } finally {
            setCheckingAvailability(false);
        }
    };

    const handleDayClick = (day) => {
        // Normalize all dates to start of day for consistent comparison
        const today = startOfDay(new Date());
        const normalizedClickedDay = startOfDay(day);

        // 1. Handle clicking on past dates
        if (normalizedClickedDay < today) {
            setAvailabilityMessage('Cannot select a past date. Please select a date today or in the future.');
            setSelectedCheckInDate(undefined); // Clear both to force a new valid selection
            setSelectedCheckOutDate(undefined);
            return;
        }

        // 2. Handle unselecting check-out date
        // If a check-out date is selected and the user clicks on it again, unselect it.
        if (selectedCheckOutDate && normalizedClickedDay.toDateString() === selectedCheckOutDate.toDateString()) {
            setSelectedCheckOutDate(undefined);
            setAvailabilityMessage('Check-out date unselected. Please select your new check-out date, or re-select check-in.');
            return; // Exit after unselecting
        }

        // 3. Handle unselecting check-in date (and resetting check-out)
        // If a check-in date is selected and the user clicks on it again, unselect both.
        if (selectedCheckInDate && normalizedClickedDay.toDateString() === selectedCheckInDate.toDateString()) {
            setSelectedCheckInDate(undefined);
            setSelectedCheckOutDate(undefined);
            setAvailabilityMessage('Check-in date unselected. Please select your check-in date.');
            return; // Exit after unselecting
        }

        // 4. Handle selecting check-in date
        // If no check-in is selected, or if the clicked day is before the current check-in (indicating a desire to re-select check-in)
        if (!selectedCheckInDate || normalizedClickedDay < selectedCheckInDate) {
            setSelectedCheckInDate(normalizedClickedDay);
            setSelectedCheckOutDate(undefined); // Always reset check-out when a new check-in is chosen
            setAvailabilityMessage('Please select your check-out date.');
        }
        // 5. Handle selecting check-out date
        // If check-in is selected and the clicked day is after check-in, set it as check-out.
        else if (selectedCheckInDate && normalizedClickedDay > selectedCheckInDate) {
            setSelectedCheckOutDate(normalizedClickedDay);
            setAvailabilityMessage(''); // Clear message if a valid range is selected
        }
    };


    const handleBookNowInitial = async () => {
        if (!hasPhysicalRooms) {
            setBookingError("Booking is not possible as there are no physical rooms available for this room type.");
            return;
        }
        if (!isAvailableForDates || !room || bookingProcessing) {
            setBookingError("Please check availability and ensure the room is selected.");
            return;
        }
        if (!isLoaded) {
            setBookingError("Authentication not loaded yet. Please wait.");
            return;
        }
        if (!isSignedIn) {
            setBookingError("Please sign in to book a room.");
            openSignIn();
            localStorage.setItem('redirectAfterSignIn', `/rooms/${id}`);
            localStorage.setItem('bookingAttemptData', JSON.stringify({
                checkInDate: selectedCheckInDate ? format(selectedCheckInDate, 'yyyy-MM-dd') : '',
                checkOutDate: selectedCheckOutDate ? format(selectedCheckOutDate, 'yyyy-MM-dd') : '',
                guests,
                roomId: id,
                actualCheckInTimeInput
            }));
            return;
        }
        if (!userId) {
            setBookingError("User ID not available. Please sign in again.");
            return;
        }

        if (!userProfile || !userProfile.gender || !userProfile.birth_date || !userProfile.address|| !userProfile.phone_number || !userProfile.id_picture_url) {
            setBookingError("Please complete your user profile and upload a valid ID before booking.");
            setShowProfileForm(true);
            return;
        }
        handleConfirmBooking();
    };

    const handleConfirmBooking = async () => {
        if (!hasPhysicalRooms) {
            setBookingError("Booking is not possible as there are no physical rooms available for this room type.");
            setBookingProcessing(false);
            return;
        }
        if (!isAvailableForDates || !room || bookingProcessing || !userId || !selectedCheckInDate || !selectedCheckOutDate) {
            setBookingError("Cannot confirm booking. Please ensure availability is checked, you are logged in, and dates are selected.");
            return;
        }
        setBookingProcessing(true);
        setAvailabilityMessage('');
        setBookingSuccessMessage('');
        setBookingError(null);

        // Normalize dates for API call
        const checkIn = format(selectedCheckInDate, 'yyyy-MM-dd');
        const checkOut = format(selectedCheckOutDate, 'yyyy-MM-dd');

        const actualCheckInDateTimeString = actualCheckInTimeInput
            ? `${checkIn}T${actualCheckInTimeInput}:00`
            : null;

        try {
            const token = await getToken();
            if (!token) {
                setBookingError("Authentication token missing. Please log in.");
                setBookingProcessing(false);
                return;
            }

            const response = await axios.post(`${BACKEND_URL}/bookings`, {
                userId: userId,
                roomId: room.id,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                totalPrice: calculatedTotalPrice,
                guests: guests,
                isPaid: false,
                actualCheckInTime: actualCheckInDateTimeString,
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            setBookingSuccessMessage('Booking successful! Your booking ID is: ' + response.data.bookingId);
            navigate('/my-bookings');
        } catch (err) {
            console.error("Error creating booking:", err.response?.data || err.message);
            setBookingError('Failed to create booking: ' + (err.response?.data?.error || err.message));
        } finally {
            setBookingProcessing(false);
        }
    };

    const handleProfileFormChange = (e) => {
        const { name, value, files } = e.target;
        setProfileFormData(prev => ({
            ...prev,
            [name]: files ? files[0] : value
        }));
    };

    const handleProfileFormSubmit = async (e) => {
        e.preventDefault();
        setProfileFormError(null);
        setProfileFormSuccess('');
        setIsProfileLoading(true);

        const profileForm = new FormData();
        profileForm.append('firstName', profileFormData.firstName);
        profileForm.append('lastName', profileFormData.lastName);
        profileForm.append('gender', profileFormData.gender);
        profileForm.append('birthDate', profileFormData.birthDate);
        profileForm.append('address', profileFormData.address);
        profileForm.append('phoneNumber', profileFormData.phoneNumber);
        if (profileFormData.idPicture) {
            profileForm.append('idPicture', profileFormData.idPicture);
        }

        try {
            const token = await getToken();
            if (!token) {
                setProfileFormError("Authentication token missing. Please log in.");
                setIsProfileLoading(false);
                return;
            }

            let response;
            if (userProfile && userProfile.id) {
                response = await axios.post(`${BACKEND_URL}/api/user-profile`, profileForm, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                });
            } else {
                response = await axios.post(`${BACKEND_URL}/api/user-profile`, profileForm, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                });
            }

            setUserProfile(response.data);
            setProfileFormSuccess('Profile updated successfully!');
            setShowProfileForm(false);

            await handleConfirmBooking();

        } catch (err) {
            console.error('Error updating user profile:', err.response?.data || err.message);
            setProfileFormError(err.response?.data?.error || 'Failed to update profile. Please try again.');
        } finally {
            setIsProfileLoading(false);
        }
    };

    const modifiers = {
        booked: bookedDates || [],
        checkIn: selectedCheckInDate, // New modifier for check-in
        checkOut: selectedCheckOutDate, // New modifier for check-out
        selectedRange: selectedCheckInDate && selectedCheckOutDate ? { from: selectedCheckInDate, to: selectedCheckOutDate } : [],
        // Apply 'noPhysicalRooms' modifier to all dates when hasPhysicalRooms is false
        // This will disable all dates if physicalRoomCount is 0, correctly aligning with logic.
        noPhysicalRooms: room && !hasPhysicalRooms ? { from: new Date(1900, 0, 1), to: new Date(2100, 11, 31) } : [],
    };

    const disabledDays = [
        { before: startOfDay(new Date()) }, // Disable past dates
        // Only disable booked dates if there are physical rooms for this type (i.e., not entirely unavailable)
        ...(physicalRoomCount > 0 ? bookedDates.map(date => startOfDay(date)) : []),
        ...(selectedCheckInDate ? [{ before: selectedCheckInDate }] : []), // Disable dates before check-in if check-in is selected
        // If there are no physical rooms, disable all dates
        ...(physicalRoomCount === 0 ? [{ from: new Date(1900, 0, 1), to: new Date(2100, 11, 31) }] : []),
    ];

    let footer;
    if (selectedCheckInDate && selectedCheckOutDate) {
        footer = `You selected check-in ${format(selectedCheckInDate, 'MMMM dd,yyyy')} to check-out ${format(selectedCheckOutDate, 'MMMM dd,yyyy')}.`;
    } else if (selectedCheckInDate) {
        footer = `You selected check-in ${format(selectedCheckInDate, 'MMMM dd,yyyy')}. Please select check-out date.`;
    } else {
        footer = 'Please select check-in date.';
    }

    if (loading) return <p className="text-center py-20">Loading room details...</p>;
    if (error) return <p className="text-center py-20 text-red-500">{error}</p>;
    if (!room) return <p className="text-center py-20">Room not found.</p>;

    // Calculate number of nights for display
    const numberOfNights = selectedCheckInDate && selectedCheckOutDate
        ? differenceInDays(startOfDay(selectedCheckOutDate), startOfDay(selectedCheckInDate))
        : 0;
    const roomPriceForStay = numberOfNights * room.pricePerNight;

    return (
        <div className="pt-28 px-4 md:px-8 lg:px-20 pb-12 flex flex-col lg:flex-row gap-20 mt-10">
            {/* Left Column: Room Images & Info */}
            <div className="flex-1">
                {mainImage && (
                    <img
                        src={mainImage}
                        alt={room.roomType}
                        className="w-133 h-80 object-cover rounded-lg shadow-md mb-6"
                    />
                )}
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
                    {room.images && room.images.map((image, index) => (
                        <img
                            key={index}
                            src={image}
                            alt={`Room view ${index + 1}`}
                            className="w-50 h-24 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setMainImage(image)}
                        />
                    ))}
                </div>

                <h1 className="text-4xl font-playfair text-gray-800 mb-2">{room.roomType}</h1>
                <p className="text-xl text-gray-600 mb-4">
                    Max Guests: {room.maxGuests}
                </p>
                <p className="text-2xl font-outfit text-primary mb-4">
                    &#8369;{room.pricePerNight.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / Night
                </p>

                <div className="flex items-center text-gray-600 mb-4">
                    <StarRating rating={room.averageRating} />
                                            <span className="ml-2">
                                                ({room.reviewCount} reviews)
                                            </span>
                </div>

                <div className="mb-6">
                    <h2 className="text-2xl font-playfair text-gray-800 mb-3">Amenities</h2>
                    <ul className="grid grid-cols-2 gap-3 text-gray-700">
                        {Array.isArray(room.amenities) && room.amenities.map((amenity, index) => (
                            <li key={index} className="flex items-center gap-2">
                                {facilityIcons[amenity] && <img src={facilityIcons[amenity]} alt={amenity} className="h-5 w-5" />}
                                <span>{amenity}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="mb-6">
                    <h2 className="text-2xl font-playfair text-gray-800 mb-3">About this room</h2>
                    <p className="text-gray-700 leading-relaxed">
                        {room.description || 'This room offers a comfortable stay with all essential amenities. Enjoy your visit!'}
                    </p>
                    <p className="border-t border-gray-300 my-4 py-4 text-gray-500">
                        Guests will be allocated on the ground floor according to availability. You get a comfortable two-bedroom apartment with a true city feeling. The price quoted is for two guests; please mark the number of guests in the guest slot to get the exact price for groups.
                        The guests will be allocated an apartment that has a true city feeling.
                    </p>
                </div>

                <div className="flex flex-col items-start gap-4">
                    <div className="flex gap-4">
                        <div>
                            <p className="text-lg md:text-xl">
                        {latestReview ? `Latest Rated by ${latestReview.first_name} ${latestReview.last_name}` : 'Rated by Guests'}
                            </p>
                            <div className="flex items-center">
                                <StarRating rating={room.averageRating} />
                                <span className="ml-2">
                                    ({room.reviewCount} reviews)
                                </span>
                            </div>
                        </div>
                    </div>
                </div> 
                
                <div className="mt-12">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Guest Reviews</h2>
                        {reviews.length > 0 ? (
                            <div>
                                {/* Map over reviews, conditionally slicing based on showAllReviews */}
                                {(showAllReviews ? reviews : reviews.slice(0, 5)).map((review, index) => (
                                    <div key={review.id || index} className="mb-4 p-4 border border-gray-200 rounded-md shadow-sm bg-gray-50">
                                        <p className="text-lg font-bold text-gray-800">{review.first_name} {review.last_name}</p> {/* Guest Name */}
                                        {/* REMOVED: <p className="text-md text-gray-600 mb-1">Very nice</p> */}
                                        <StarRating rating={review.rating} isEditable={false} />
                                        <p className="mt-2 text-gray-700">{review.comment}</p> {/* Actual Review Comment */}
                                        <p className="text-sm text-gray-500 mt-1">
                                            Reviewed on: {new Date(review.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))}

                                {/* "Show More" button */}
                                {reviews.length > 5 && !showAllReviews && (
                                    <div className="text-center mt-6">
                                        <button
                                            onClick={() => setShowAllReviews(true)}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ease-in-out"
                                        >
                                            Show All {reviews.length} Comments
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-600">No reviews yet for this room type. Be the first to leave one!</p>
                        )}
                    </div>

            </div>

           
            {/* Right Column: Booking Widget */}
            <div className="lg:w-96 p-6 bg-white rounded-lg shadow-lg flex-shrink-0">
                <h2 className="text-4xl font-playfair text-gray-800 mb-4">Book Your Stay</h2>

                {bookingSuccessMessage && <p className="text-green-600 mb-4">{bookingSuccessMessage}</p>}
                {bookingError && <p className="text-red-600 mb-4">{bookingError}</p>}

                <div className="mb-4">
                    <label htmlFor="guests" className="block text-gray-700 text-sm font-playfair mb-2">Number of Guests:</label>
                    <input
                        type="number"
                        id="guests"
                        value={guests}
                        onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        max={room.maxGuests}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                    {room.maxGuests && <p className="text-sm text-gray-500 mt-1">Max capacity: {room.maxGuests} guests</p>}
                </div>

                <div className="mb-4">
                    <p className="block text-gray-700 text-sm font-bold mb-2">Select Dates:</p>
                    <p className="block text-gray-700 text-sm mb-2">Click the selected Check-In Date to Reset</p>
                    <DayPicker
                        mode="single" // Using single mode, but handling range selection manually in handleDayClick
                        selected={selectedCheckOutDate} // Selected highlights only the single check-out date
                        onSelect={handleDayClick}
                        modifiers={modifiers}
                        modifiersStyles={{
                            checkIn: { backgroundColor: 'lightgreen', color: 'black' }, // Green for check-in
                            checkOut: { backgroundColor: 'red', color: 'white' },   // Red for check-out
                            selectedRange: { backgroundColor: 'lightgreen', color: 'black' }, // Light green for the range
                            booked: {
                                backgroundColor: '#ffdddd',
                                textDecoration: 'line-through',
                                color: '#cc0000',
                                opacity: 0.7,
                            },
                            noPhysicalRooms: {
                                backgroundColor: '#ffdddd', // Lighter red background
                                textDecoration: 'line-through',
                                color: '#cc0000',
                                opacity: 0.7,
                            },
                        }}
                        disabled={disabledDays}
                        footer={footer}
                        className="booking-calendar"
                    />
                </div>

                {/* Desired Check-in Time Input - now read-only */}
                <div className="mb-4">
                    <label htmlFor="actualCheckInTime" className="block text-gray-700 text-sm font-bold mb-2">
                        Desired Check-in Time (Standard is 2:00 PM):
                    </label>
                    <input
                        type="time"
                        id="actualCheckInTime"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        value={actualCheckInTimeInput}
                        readOnly // Make it non-editable
                    />
                </div>

                {availabilityMessage && (
                    <p className={`text-center mb-4 ${isAvailableForDates ? 'text-green-600' : 'text-red-600'}`}>
                        {availabilityMessage}
                    </p>
                )}

                {/* Clear Calculation Display */}
                {(selectedCheckInDate && selectedCheckOutDate && numberOfNights > 0) && (
                    <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gradient-to-r from-blue-50 to-white shadow-md">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Booking Summary</h3>
                        <div className="flex justify-between mb-1">
                            <span className="text-gray-700">Room Price ({numberOfNights} nights):</span>
                            <span className="font-semibold">&#8369;{roomPriceForStay.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between items-center">
                            <span className="text-xl font-bold text-gray-800">Total Price:</span>
                            <span className="text-2xl font-bold text-primary">&#8369;{calculatedTotalPrice.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                <button
                    onClick={handleBookNowInitial}
                    className={`w-full py-3 rounded text-white font-semibold transition-colors ${isAvailableForDates && !bookingProcessing && !checkingAvailability && calculatedTotalPrice > 0 && selectedCheckInDate && selectedCheckOutDate ? 'bg-primary hover:bg-primary-dull cursor-pointer' : 'bg-gray-400 cursor-not-allowed'
                        }`}
                    disabled={!isAvailableForDates || bookingProcessing || checkingAvailability || isProfileLoading || calculatedTotalPrice <= 0 || !selectedCheckInDate || !selectedCheckOutDate}
                >
                    {checkingAvailability ? 'Checking Availability...' : bookingProcessing ? 'Processing Booking...' : 'Book Now'}
                </button>

                {!isSignedIn && (
                    <p className="text-red-500 text-sm mt-2 text-center">Please log in to book a room.</p>
                )}

                {showProfileForm && (
                    <div className="mt-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <h3 className="text-lg font-bold text-gray-800 mb-3">Complete Your Profile</h3>
                        {profileFormSuccess && <p className="text-green-600 mb-3">{profileFormSuccess}</p>}
                        {profileFormError && <p className="text-red-600 mb-3">{profileFormError}</p>}
                        <form onSubmit={handleProfileFormSubmit} className="flex flex-col gap-3">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name</label>
                                <input type="text" name="firstName" id="firstName" value={profileFormData.firstName} onChange={handleProfileFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                                <input type="text" name="lastName" id="lastName" value={profileFormData.lastName} onChange={handleProfileFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                            </div>
                            <div>
                                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
                                <input type="tel" name="phoneNumber" id="phoneNumber" value={profileFormData.phoneNumber} onChange={handleProfileFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                            </div>
                            <div>
                                <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                                <select name="gender" id="gender" value={profileFormData.gender} onChange={handleProfileFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700">Birth Date</label>
                                <input type="date" name="birthDate" id="birthDate" value={profileFormData.birthDate} onChange={handleProfileFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                            </div>
                            <div>
                                <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
                                <textarea name="address" id="address" value={profileFormData.address} onChange={handleProfileFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"></textarea>
                            </div>
                            <div>
                                <label htmlFor="idPicture" className="block text-sm font-medium text-gray-700">Upload ID Picture</label>
                                <input type="file" name="idPicture" id="idPicture" onChange={handleProfileFormChange} accept="image/*" className="border border-gray-300 rounded-md shadow-sm p-2 mt-1 block w-full cursor-pointer" />
                                {userProfile?.id_picture_url && (
                                    <p className="text-sm text-gray-500 mt-1">Current ID uploaded.</p>
                                )}
                            </div>
                            <button
                                type="submit"
                                className="w-full py-2 rounded text-white font-semibold transition-colors bg-blue-600 hover:bg-blue-700 mt-4"
                                disabled={isProfileLoading}
                            >
                                {isProfileLoading ? 'Saving Profile...' : 'Save Profile'}
                            </button>
                        </form>
                    </div>
                )}

            </div>
        </div>
    );
};

export default RoomDetails;