// src/pages/User/MyBookings.jsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { assets } from '../assets/assets'; // Adjust path if necessary
import { useAuth } from '@clerk/clerk-react';
import { io } from 'socket.io-client'; // Import socket.io-client
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; // For star icons
import { faStar as solidStar } from '@fortawesome/free-solid-svg-icons'; // Solid star for filled
import { faStar as regularStar } from '@fortawesome/free-regular-svg-icons'; // Regular star for outline
import { differenceInDays } from 'date-fns';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const BANK_ACCOUNT_NUMBER = import.meta.env.VITE_BANK_ACCOUNT_NUMBER || '0000-0000-0000';
const GCASH_NUMBER = import.meta.env.VITE_GCASH_NUMBER || '0993-116-9301';

// Star Rating Component (Helper component for MyBookings)
const StarRating = ({ rating, setRating, isEditable }) => {
    const [hoverRating, setHoverRating] = useState(0);

    return (
        <div className="flex items-center">
            {[...Array(5)].map((star, index) => {
                const currentRating = index + 1;
                return (
                    <label key={index} className="cursor-pointer">
                        <input
                            type="radio"
                            name="rating"
                            value={currentRating}
                            onClick={() => isEditable && setRating(currentRating)}
                            className="hidden"
                            disabled={!isEditable}
                        />
                        <FontAwesomeIcon
                            icon={currentRating <= (hoverRating || rating) ? solidStar : regularStar}
                            className={`text-2xl ${isEditable ? 'text-yellow-500' : 'text-yellow-400'}`}
                            onMouseEnter={() => isEditable && setHoverRating(currentRating)}
                            onMouseLeave={() => isEditable && setHoverRating(0)}
                        />
                    </label>
                );
            })}
        </div>
    );
};


const MyBookings = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { userId, isLoaded, isSignedIn, getToken } = useAuth();
    const [showDetails, setShowDetails] = useState({});
    // NEW: State for managing rating modals/forms
    const [showRatingModal, setShowRatingModal] = useState(null); // Stores booking ID for the modal
    const [currentRating, setCurrentRating] = useState(0);
    const [currentComment, setCurrentComment] = useState('');
    const [ratingError, setRatingError] = useState(null);

    // NEW: Payment modal state
    const [showPaymentModal, setShowPaymentModal] = useState(null); // Stores booking ID
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentError, setPaymentError] = useState(null);

    console.log("Current Logged-in Clerk User ID:", userId);

    const fetchMyBookings = useCallback(async () => {
        if (!isLoaded || !isSignedIn || !userId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const token = await getToken();
            if (!token) {
                setError("Authentication token missing. Please log in again.");
                setLoading(false);
                return;
            }

            const response = await axios.get(`${BACKEND_URL}/bookings/user/${userId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setBookings(response.data);
            const initialDetailsState = {};
            response.data.forEach(booking => {
                initialDetailsState[booking.id] = false;
            });
            setShowDetails(initialDetailsState);
            console.log("My Bookings Data:", response.data);
        } catch (err) {
            console.error('Failed to fetch my bookings:', err.response?.data || err.message);
            setError(err.response?.data?.error || 'Failed to fetch your bookings.');
        } finally {
            setLoading(false);
        }
    }, [userId, isLoaded, isSignedIn, getToken]);

    const handlePayNow = (bookingId) => {
        setShowPaymentModal(bookingId);
        setReferenceNumber('');
        setPaymentError(null);
    };

    const handleClosePaymentModal = () => {
        setShowPaymentModal(null);
        setReferenceNumber('');
        setPaymentError(null);
    };

    const handleSubmitPayment = async () => {
        if (!showPaymentModal) return;
        if (!referenceNumber || referenceNumber.trim().length < 4) {
            setPaymentError('Please enter a valid reference number.');
            return;
        }
        try {
            const token = await getToken();
            await axios.patch(
                `${BACKEND_URL}/bookings/${showPaymentModal}/mark-paid`,
                { referenceNumber },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('Payment submitted! We have marked your booking as paid.');
            handleClosePaymentModal();
            fetchMyBookings();
        } catch (err) {
            console.error('Failed to mark booking as paid:', err.response?.data || err.message);
            setPaymentError(err.response?.data?.error || 'Failed to submit payment.');
        }
    };

    const toggleDetails = (bookingId) => {
        setShowDetails(prevDetails => ({
            ...prevDetails,
            [bookingId]: !prevDetails[bookingId]
        }));
    };

    // NEW: Handle "Rate Room" button click
    const handleRateRoomClick = (booking) => {
        setShowRatingModal(booking.id);
        setCurrentRating(booking.userRating ? booking.userRating.rating : 0); // Pre-fill if already rated
        setCurrentComment(booking.userRating ? booking.userRating.comment : ''); // Pre-fill comment
        setRatingError(null); // Clear previous errors
    };

    // NEW: Handle rating submission
    const submitRating = async (bookingId, roomId, physicalRoomId) => {
        setRatingError(null);
        if (currentRating === 0) {
            setRatingError('Please select a star rating.');
            return;
        }

        try {
            const token = await getToken();
            await axios.post(`${BACKEND_URL}/bookings/${bookingId}/rate`, {
                rating: currentRating,
                comment: currentComment,
                roomId: roomId, // Pass roomId to associate rating with room type
                physicalRoomId: physicalRoomId // Pass physicalRoomId if specific room is rated
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            alert('Room rated successfully!');
            setShowRatingModal(null); // Close modal
            fetchMyBookings(); // Refresh bookings to show new rating
        } catch (err) {
            console.error('Failed to submit rating:', err.response?.data || err.message);
            setRatingError(err.response?.data?.error || 'Failed to submit rating.');
        }
    };

    const handleCancelBooking = async (bookingId) => {
        if (window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
            try {
                const token = await getToken();
                await axios.patch(`${BACKEND_URL}/bookings/${bookingId}/cancel`, {}, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                alert('Booking cancelled successfully!');
                fetchMyBookings(); // Refresh the list of bookings
            } catch (err) {
                console.error('Failed to cancel booking:', err.response?.data || err.message);
                alert(`Failed to cancel booking: ${err.response?.data?.error || 'Unknown error'}`);
            }
        }
    }

    useEffect(() => {
        fetchMyBookings();

        const socket = io(BACKEND_URL);

        socket.on('connect', () => {
            console.log('Socket.IO connected from MyBookings');
        });

        socket.on('newBookingCreated', (newBooking) => {
            if (newBooking.userId === userId) {
                console.log('Real-time: New booking created for current user', newBooking);
                fetchMyBookings();
            }
        });

        socket.on('bookingApproved', (updatedBooking) => {
            if (updatedBooking.userId === userId) {
                console.log('Real-time: Booking approved for current user', updatedBooking);
                fetchMyBookings();
            }
        });

        socket.on('bookingRejected', (updatedBooking) => {
            if (updatedBooking.userId === userId) {
                console.log('Real-time: Booking rejected for current user', updatedBooking);
                fetchMyBookings();
            }
        });

        socket.on('bookingPaid', (updatedBooking) => {
            if (updatedBooking.userId === userId) {
                console.log('Real-time: Booking paid for current user', updatedBooking);
                fetchMyBookings();
            }
        });

        socket.on('bookingExtended', (updatedBooking) => {
            if (updatedBooking.userId === userId) {
                console.log('Real-time: Booking extended for current user', updatedBooking);
                fetchMyBookings();
            }
        });

        socket.on('bookingCheckedOut', (updatedBooking) => {
            if (updatedBooking.userId === userId) {
                console.log('Real-time: Booking checked out for current user', updatedBooking);
                fetchMyBookings();
            }
        });

        socket.on('disconnect', () => {
            console.log('Socket.IO disconnected from MyBookings');
        });

        return () => {
            socket.disconnect();
        };
    }, [fetchMyBookings, userId]);

    if (loading) {
        return <div className="p-8 text-center">Loading your bookings...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    }

    if (!isSignedIn) {
        return <div className="p-8 text-center text-gray-600">Please log in to view your bookings.</div>;
    }

    return (
        <div className="p-6 md:p-8 lg:p-10">
            <h1 className="text-3xl md:text-4xl font-playfair mb-8 text-gray-800">My Bookings</h1>

            {bookings.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-lg text-gray-600 mb-4">You don't have any bookings yet.</p>
                    <Link to="/rooms" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition duration-200 ease-in-out">
                        Browse Rooms
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bookings.map((booking) => {
                        const firstImg = booking.roomImages && booking.roomImages.length > 0 ? booking.roomImages[0] : null;
                        const displayImage = firstImg
                            ? (firstImg.startsWith('http')
                                ? firstImg
                                : (firstImg.startsWith('/')
                                    ? `${BACKEND_URL}${firstImg}`
                                    : `${BACKEND_URL}/uploads/room_images/${firstImg}`))
                            : assets.placeholder_room_image;

                            const startForNights = booking.checkInDateAndTime || booking.checkInDate;
                        const endForNights = booking.checkOutDateAndTime || booking.checkOutDate;
                        const computedNights = (startForNights && endForNights)
                            ? differenceInDays(new Date(endForNights), new Date(startForNights))
                            : (typeof booking.nights === 'number' ? booking.nights : null);


                        return (
                            <div key={booking.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
                                 <img
                                    src={displayImage}
                                    alt={booking.roomType}
                                    className="w-full h-48 object-cover"
                                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = assets.placeholder_room_image; }}
                                />
                                <div className="p-4">
                                    <h3 className="text-xl font-playfair text-gray-800 mb-2">{booking.roomType}</h3>
                                    
                                    <p className="text-gray-600 text-sm mb-1">
                                        <i className="fas fa-calendar-alt mr-2"></i>
                                        Check-in: {new Date(booking.checkInDate).toLocaleDateString()}
                                    </p>
                                    <p className="text-gray-600 text-sm mb-1">
                                        <i className="fas fa-calendar-alt mr-2"></i>
                                        Check-out: {new Date(booking.checkOutDate).toLocaleDateString()}
                                    </p>
                                    <p className="text-gray-600 text-sm mb-1">
                                        <i className="fas fa-moon mr-2"></i>
                                        Nights: {computedNights ?? 'N/A'}
                                    </p>

                                    {showDetails[booking.id] && (
                                        <div>
                                            {booking.actualCheckInTime && (
                                                <p className="text-gray-600 text-sm mb-1">
                                                    <i className="fas fa-clock mr-2"></i>
                                                    Actual Check-in: {new Date(booking.actualCheckInTime).toLocaleString()}
                                                </p>
                                            )}
                                            {booking.actualCheckOutTime && (
                                                <p className="text-gray-600 text-sm mb-1">
                                                    <i className="fas fa-clock mr-2"></i>
                                                    Actual Check-out: {new Date(booking.actualCheckOutTime).toLocaleString()}
                                                </p>
                                            )}
                                            {booking.assignedRoomNumber && (
                                                <p className="text-gray-600 text-sm mb-1">
                                                    <i className="fas fa-door-open mr-2"></i>
                                                    Assigned Room: {booking.assignedRoomNumber}
                                                </p>
                                            )}
                                            <p className="text-gray-600 text-sm mb-1">
                                                <i className="fas fa-users mr-2"></i>
                                                Guests: {booking.guests}
                                            </p>
                                            <p className="text-gray-600 text-sm mb-1">
                                                <i className="fas fa-money-bill-wave mr-2"></i>
                                                Total Price: ₱{booking.totalPrice.toFixed(2)}
                                            </p>
                                            {booking.earlyCheckInFee > 0 && (
                                                <p className="text-gray-600 text-sm mb-1">
                                                    <i className="fas fa-peso-sign mr-2"></i>
                                                    Early Check-in Fee: ₱{booking.earlyCheckInFee.toFixed(2)}
                                                </p>
                                            )}
                                            <p className="text-gray-600 text-sm mb-1">
                                                <i className="fas fa-receipt mr-2"></i>
                                                Payment Status: <span className={`font-semibold ${booking.paymentStatus === 'Fully Paid' ? 'text-green-700' : booking.paymentStatus === 'Partial' ? 'text-yellow-700' : 'text-red-700'}`}>
                                                    {booking.paymentStatus || (booking.isPaid ? 'Fully Paid' : 'Not Paid')}
                                                </span>
                                            </p>
                                        </div>
                                    )}

                                    <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                                        <span className={`px-3 py-1 rounded-full text-sm font-semibold
                                            ${booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            booking.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            booking.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                            booking.status === 'checked_out' ? 'bg-gray-200 text-gray-800' :
                                            'bg-gray-100 text-gray-800'}`}>
                                            {booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1).replace('_', ' ') : 'N/A'}
                                        </span>

                                        <button
                                            onClick={() => toggleDetails(booking.id)}
                                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-1 px-3 rounded text-sm transition duration-200 ease-in-out"
                                        >
                                            {showDetails[booking.id] ? 'Hide Details' : 'Details'}
                                        </button>

                                        {booking.status === 'approved' && !booking.isPaid && (
                                            <button
                                                onClick={() => handlePayNow(booking.id)}
                                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm transition duration-200 ease-in-out"
                                            >
                                                Pay Now
                                            </button>
                                        )}
                                        {booking.status === 'rejected' && booking.rejection_reason && (
                                            <span className="text-red-500 text-xs italic ml-2">Reason: {booking.rejection_reason}</span>
                                        )}

                                        {booking.status === 'pending' && (
                                            <button
                                                onClick={() => handleCancelBooking(booking.id)}
                                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 text-sm rounded transition duration-200 ease-in-out cursor-pointer"
                                            >
                                                Cancel Booking
                                            </button>
                                        )}

                                        {/* NEW: Rate Room Button or Display Rating */}
                                        {booking.status === 'checked_out' && (
                                            booking.userRating ? (
                                                <div className="flex items-center mt-2">
                                                    <span className="text-gray-600 text-sm mr-2">Your Rating:</span>
                                                    <StarRating rating={booking.userRating.rating} isEditable={false} />
                                                    <button
                                                        onClick={() => handleRateRoomClick(booking)}
                                                        className="ml-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded text-xs transition duration-200 ease-in-out"
                                                    >
                                                        Edit Rating
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleRateRoomClick(booking)}
                                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded text-sm transition duration-200 ease-in-out"
                                                >
                                                    Rate Room
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* NEW: Rating Modal */}
            {showRatingModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-md">
                        <h2 className="text-2xl font-playfair mb-4 text-gray-800">Rate Your Stay</h2>
                        <p className="mb-4 text-gray-700">How was your experience at {bookings.find(b => b.id === showRatingModal)?.roomType}?</p>
                        
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Your Rating:
                            </label>
                            <StarRating rating={currentRating} setRating={setCurrentRating} isEditable={true} />
                            {ratingError && <p className="text-red-500 text-xs mt-2">{ratingError}</p>}
                        </div>

                        <div className="mb-6">
                            <label htmlFor="comment" className="block text-gray-700 text-sm font-bold mb-2">
                                Comment (Optional):
                            </label>
                            <textarea
                                id="comment"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                rows="3"
                                value={currentComment}
                                onChange={(e) => setCurrentComment(e.target.value)}
                                placeholder="Share your experience..."
                            ></textarea>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowRatingModal(null)}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const booking = bookings.find(b => b.id === showRatingModal);
                                    if (booking) {
                                        submitRating(booking.id, booking.roomTypeId, booking.physicalRoomId);
                                    }
                                }}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-200 ease-in-out"
                            >
                                Submit Rating
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
           
            {/* NEW: Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-md">
                        <h2 className="text-2xl font-playfair mb-4 text-gray-800">Payment Instructions</h2>
                        <p className="text-gray-700 mb-4">Please transfer your payment using one of the methods below and enter your transaction reference number.</p>

                        <div className="space-y-3 mb-6">
                            <div className="border rounded-md p-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Bank Account</p>
                                    <p className="font-semibold text-gray-800">{BANK_ACCOUNT_NUMBER}</p>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard?.writeText(BANK_ACCOUNT_NUMBER)}
                                    className="text-blue-600 text-sm hover:underline"
                                >
                                    Copy
                                </button>
                            </div>
                            <div className="border rounded-md p-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">GCash Number</p>
                                    <p className="font-semibold text-gray-800">{GCASH_NUMBER}</p>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard?.writeText(GCASH_NUMBER)}
                                    className="text-blue-600 text-sm hover:underline"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label htmlFor="referenceNumber" className="block text-gray-700 text-sm font-bold mb-2">
                                Reference Number
                            </label>
                            <input
                                id="referenceNumber"
                                type="text"
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                placeholder="Enter your transaction reference number"
                            />
                            {paymentError && <p className="text-red-500 text-xs mt-2">{paymentError}</p>}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleClosePaymentModal}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitPayment}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-200 ease-in-out"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyBookings;
