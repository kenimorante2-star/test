import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { io } from 'socket.io-client';
import { differenceInHours } from 'date-fns'; // Import differenceInHours

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const AdminDashboard = () => {
    const { isLoaded, isSignedIn, getToken } = useAuth();

    const [dashboardData, setDashboardData] = useState({
        totalUsers: 0,
        totalRooms: 0,
        totalBookings: 0, // This will now represent the combined total
        totalRevenue: 0,
        bookings: [], // For regular bookings
        users: [],
        rooms: []
    });
    const [walkInBookingsData, setWalkInBookingsData] = useState([]); // New state for walk-in bookings
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [currentBookingToReject, setCurrentBookingToReject] = useState(null);
    const [rejectionMessage, setRejectionMessage] = useState('');

    const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
    const [selectedUserDetails, setSelectedUserDetails] = useState(null);
    const [fetchingUserDetails, setFetchingUserDetails] = useState(false);
    const [userDetailsError, setUserDetailsError] = useState(null);

    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [currentBookingToApprove, setCurrentBookingToApprove] = useState(null);
    const [availablePhysicalRooms, setAvailablePhysicalRooms] = useState([]);
    const [selectedPhysicalRoomId, setSelectedPhysicalRoomId] = useState('');
    const [selectedAssignedRoomNumber, setSelectedAssignedRoomNumber] = useState('');
    const [approvingBooking, setApprovingBooking] = useState(false);

    // Online Booking Extend State
    const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
    const [currentBookingToExtend, setCurrentBookingToExtend] = useState(null);
    const [newExtendCheckOutDate, setNewExtendCheckOutDate] = useState('');
    const [extendingBooking, setExtendingBooking] = useState(false);

    // Online Booking Checkout State
    const [isCheckoutConfirmModalOpen, setIsCheckoutConfirmModalOpen] = useState(false);
    const [currentBookingToCheckout, setCurrentBookingToCheckout] = useState(null);
    const [checkingOutBooking, setCheckingOutBooking] = useState(false);

    const [isCashModalOpen, setIsCashModalOpen] = useState(false);
    const [currentOnlineBookingToPay, setCurrentOnlineBookingToPay] = useState(null);
    const [onlinePaymentAmount, setOnlinePaymentAmount] = useState('');
    const [onlinePaymentError, setOnlinePaymentError] = useState(null);
    const [processingOnlinePayment, setProcessingOnlinePayment] = useState(false);

    // Walk-In Booking Pay Now State
    const [isPayNowModalOpen, setIsPayNowModalOpen] = useState(false);
    const [currentBookingToPay, setCurrentBookingToPay] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentError, setPaymentError] = useState(null);
    const [processingPayment, setProcessingPayment] = useState(false);

    // Walk-In Booking Extend State (NEW)
    const [isExtendWalkInModalOpen, setIsExtendWalkInModalOpen] = useState(false);
    const [currentWalkInBookingToExtend, setCurrentWalkInBookingToExtend] = useState(null);
    const [walkInNightsToExtend, setWalkInNightsToExtend] = useState(1);
    const [walkInPaymentAmount, setWalkInPaymentAmount] = useState(0);
    const [extendingWalkInBooking, setExtendingWalkInBooking] = useState(false);
    const [walkInExtendError, setWalkInExtendError] = useState(''); // Initial state as empty string

    // Walk-In Booking Checkout State (NEW)
    const [isCheckoutWalkInConfirmModalOpen, setIsCheckoutWalkInConfirmModalOpen] = useState(false);
    const [currentWalkInBookingToCheckout, setCurrentWalkInBookingToCheckout] = useState(null);
    const [checkingOutWalkInBooking, setCheckingOutWalkInBooking] = useState(false);

    // Walk In User
    const [showWalkInUserDetailsModal, setShowWalkInUserDetailsModal] = useState(false);
    const [selectedWalkInUserDetails, setSelectedWalkInUserDetails] = useState(null);
    const [fetchingWalkInUserDetails, setFetchingWalkInUserDetails] = useState(false);
    const [userWalkInDetailsError, setWalkInUserDetailsError] = useState(null);

    const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
    const [selectedUserEmail, setSelectedUserEmail] = useState('');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);

    const [showBookingDetailsModal, setShowBookingDetailsModal] = useState(false);

    // Robust local datetime formatter for MySQL DATETIME strings
    // Ensures strings like 'YYYY-MM-DD HH:mm:ss' are treated as local time
    const parseMySQLDateTimeToLocal = (value) => {
        if (!value) return null;
        if (value instanceof Date) return isNaN(value) ? null : value;
        if (typeof value !== 'string') return null;

        const trimmed = value.trim();
        // Normalize to 'YYYY-MM-DD HH:mm:ss' and DROP timezone/fragments if present
        // 1) Replace 'T' with space
        // 2) Strip trailing 'Z' or timezone offset like +08:00 / -0500
        // 3) Drop fractional seconds
        let normalized = trimmed
            .replace('T', ' ')
            .replace(/[zZ]$/, '')
            .replace(/([+-]\d{2}:?\d{2})$/, '')
            .trim();

        // Split date and time
        const [datePartRaw, timePartRaw] = normalized.split(' ');
        if (!datePartRaw) return null;

        const [yStr, mStr, dStr] = datePartRaw.split('-');
        const year = parseInt(yStr, 10);
        const month = parseInt(mStr, 10) - 1; // zero-based month
        const day = parseInt(dStr, 10);
        let hours = 0, minutes = 0, seconds = 0;
        if (timePartRaw) {
            const timeMain = timePartRaw.split('.')[0]; // remove fractional seconds if any
            const [hStr = '0', minStr = '0', sStr = '0'] = timeMain.split(':');
            hours = parseInt(hStr, 10) || 0;
            minutes = parseInt(minStr, 10) || 0;
            seconds = parseInt(sStr, 10) || 0;
        }
        const local = new Date(year, month, day, hours, minutes, seconds, 0);
        return isNaN(local) ? null : local;
    };

    const formatLocalDateTime = (value) => {
        const d = parseMySQLDateTimeToLocal(value);
        return d ? d.toLocaleString() : 'N/A';
    };

    








    const fetchBookings = useCallback(async () => {
        if (!isLoaded || !isSignedIn) {
            console.log("Clerk not loaded or user not signed in, skipping fetchBookings.");
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

            // Fetch regular bookings
            const response = await axios.get(`${BACKEND_URL}/admin/bookings`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            console.log('Regular Bookings Data:', response.data.bookings);
            setDashboardData(prevData => ({
                ...prevData,
                bookings: response.data.bookings,
                // totalBookings: response.data.totalBookings, // This total is now handled by fetchDashboardSummary
                // totalRevenue: response.data.totalRevenue // This total is now handled by fetchDashboardSummary
            }));
        } catch (err) {
            console.error('Failed to fetch regular bookings:', err.response?.data || err.message);
            setError(err.response?.data?.error || 'Failed to fetch regular bookings data.');
        } finally {
            setLoading(false);
        }
    }, [isLoaded, isSignedIn, getToken]);

    // NEW: Function to fetch walk-in bookings
    const fetchWalkInBookings = useCallback(async () => {
        if (!isLoaded || !isSignedIn) {
            console.log("Clerk not loaded or user not signed in, skipping fetchWalkInBookings.");
            return;
        }

        try {
            const token = await getToken();
            if (!token) {
                console.error("Authentication token missing for walk-in bookings. Please log in again.");
                return;
            }

            const response = await axios.get(`${BACKEND_URL}/admin/walk-in-bookings`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            console.log('Walk-In Bookings Data:', response.data);
            setWalkInBookingsData(response.data);
        } catch (err) {
            console.error('Failed to fetch walk-in bookings:', err.response?.data || err.message);
            // You might want a separate error state for walk-in bookings if needed
        }
    }, [isLoaded, isSignedIn, getToken]);


    const fetchUsers = useCallback(async () => {
        if (!isLoaded || !isSignedIn) return;
        try {
            const token = await getToken();
            const response = await axios.get(`${BACKEND_URL}/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDashboardData(prevData => ({ ...prevData, users: response.data }));
        } catch (err) {
            console.error('Failed to fetch users:', err.response?.data || err.message);
        }
    }, [isLoaded, isSignedIn, getToken]);

    const fetchRooms = useCallback(async () => {
        if (!isLoaded || !isSignedIn) return;
        try {
            const token = await getToken();
            const response = await axios.get(`${BACKEND_URL}/admin/rooms`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDashboardData(prevData => ({ ...prevData, rooms: response.data }));
        } catch (err) {
            console.error('Failed to fetch rooms:', err.response?.data || err.message);
        }
    }, [isLoaded, isSignedIn, getToken]);

    const fetchDashboardSummary = useCallback(async () => {
        if (!isLoaded || !isSignedIn) return;
        try {
            const token = await getToken();
            const response = await axios.get(`${BACKEND_URL}/admin/dashboard-summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDashboardData(prevData => ({
                ...prevData,
                totalUsers: response.data.totalUsers,
                totalRooms: response.data.totalRooms,
                totalBookings: response.data.totalBookings, // Now correctly uses the combined total
                totalRevenue: response.data.totalRevenue
            }));
        } catch (err) {
            console.error('Failed to fetch dashboard summary:', err.response?.data || err.message);
        }
    }, [isLoaded, isSignedIn, getToken]);


    useEffect(() => {
        fetchDashboardSummary();
        fetchBookings(); // Fetch regular bookings
        fetchWalkInBookings(); // NEW: Fetch walk-in bookings
        fetchUsers();
        fetchRooms();

        const socket = io(BACKEND_URL);

        socket.on('connect', () => {
            console.log('Socket.IO connected from Admin Dashboard');
        });

        socket.on('newBookingCreated', (newBooking) => {
            console.log('Real-time: New booking created', newBooking);
            // If the new booking is a walk-in, refresh walk-in bookings, else refresh regular bookings
            // The backend's newBookingCreated event is for online bookings.
            fetchBookings();
            fetchDashboardSummary();
        });

        socket.on('newWalkInBooking', (newBooking) => { // Listen for new walk-in bookings
            console.log('Real-time: New walk-in booking created', newBooking);
            fetchWalkInBookings(); // Refresh walk-in bookings
            fetchDashboardSummary();
        });

        socket.on('bookingApproved', (updatedBooking) => {
            console.log('Real-time: Booking approved', updatedBooking);
            fetchBookings();
            fetchDashboardSummary();
        });

        socket.on('bookingRejected', (updatedBooking) => {
            console.log('Real-time: Booking rejected', updatedBooking);
            fetchBookings();
            fetchDashboardSummary();
        });

        socket.on('bookingPaymentUpdated', (updatedBooking) => { // Listen for payment updates
            console.log('Real-time: Booking payment updated', updatedBooking);
            fetchWalkInBookings(); // Refresh walk-in bookings
            fetchDashboardSummary();
        });

        socket.on('bookingExtended', (updatedBooking) => {
            console.log('Real-time: Booking extended', updatedBooking);
            // Check if it's an online or walk-in booking based on available data
            // For simplicity, refreshing both for now, or add a flag to the emitted data
            // Assuming 'isWalkIn' flag is passed from backend if it's a walk-in booking
            if (updatedBooking.isWalkIn) {
                fetchWalkInBookings();
            } else {
                fetchBookings();
            }
            fetchDashboardSummary();
        });

        socket.on('bookingCheckedOut', (updatedBooking) => {
            console.log('Real-time: Booking checked out', updatedBooking);
            // Similar to extend, check for walk-in flag or refresh both
            if (updatedBooking.isWalkIn) {
                fetchWalkInBookings();
            } else {
                fetchBookings();
            }
            fetchDashboardSummary();
        });

        socket.on('disconnect', () => {
            console.log('Socket.IO disconnected from Admin Dashboard');
        });

        return () => {
            socket.disconnect();
        };
    }, [fetchDashboardSummary, fetchBookings, fetchWalkInBookings, fetchUsers, fetchRooms]); // Added fetchWalkInBookings to dependencies

//======Online UserDetails
    const handleViewUserDetails = async (userId) => {
        setFetchingUserDetails(true);
        setSelectedUserDetails(null);
        setUserDetailsError(null);
        try {
            const token = await getToken();
            const response = await axios.get(`${BACKEND_URL}/api/user-profile/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedUserDetails(response.data);
            setShowUserDetailsModal(true);
        } catch (err) {
            console.error('Failed to fetch user details:', err.response?.data || err.message);
            setUserDetailsError(err.response?.data?.error || 'Failed to fetch user details.');
        } finally {
            setFetchingUserDetails(false);
        }
    };

    const handleCloseUserDetailsModal = () => {
        setShowUserDetailsModal(false);
        setSelectedUserDetails(null);
        setUserDetailsError(null);
    };
//========Walk In UserDetails
    const handleViewWalkInUserDetails = async (userId) => {
        setFetchingWalkInUserDetails(true);
        setSelectedWalkInUserDetails(null);
        setWalkInUserDetailsError(null);
        try {
            const token = await getToken();
            const response = await axios.get(`${BACKEND_URL}/api/walk-in-user-profile/${userId}:bookingId`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedWalkInUserDetails(response.data);
            setShowWalkInUserDetailsModal(true);
        } catch (err) {
            console.error('Failed to fetch user details:', err.response?.data || err.message);
            setWalkInUserDetailsError(err.response?.data?.error || 'Failed to fetch user details.');
        } finally {
            setFetchingWalkInUserDetails(false);
        }
    };
    const handleCloseWalkInUserDetailsModal = () => {
        setShowWalkInUserDetailsModal(false);
        setSelectedWalkInUserDetails(null);
        setWalkInUserDetailsError(null);
    };

//=====================================

    const handleRejectClick = (booking) => {
        setCurrentBookingToReject(booking);
        setRejectionMessage('');
        setIsRejectModalOpen(true);
    };

    const handleCloseRejectModal = () => {
        setIsRejectModalOpen(false);
        setCurrentBookingToReject(null);
        setRejectionMessage('');
    };

    const handleConfirmReject = async () => {
        if (!currentBookingToReject) return;
        if (!rejectionMessage.trim()) {
            // Use a custom modal or toast for alerts instead of alert()
            // For now, keeping alert for direct replacement
            alert('Please provide a reason for rejection.');
            return;
        }

        setLoading(true);
        try {
            const token = await getToken();
            await axios.patch(`${BACKEND_URL}/admin/bookings/${currentBookingToReject.id}/reject`,
                { rejectionReason: rejectionMessage },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            alert('Booking rejected successfully!');
            fetchBookings();
            fetchWalkInBookings(); // Refresh walk-in bookings too
            handleCloseRejectModal();
        } catch (err) {
            console.error('Failed to reject booking:', err.response?.data || err.message);
            alert(`Failed to reject booking: ${err.response?.data?.error || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleApproveClick = async (booking) => {
        setCurrentBookingToApprove(booking);
        setSelectedPhysicalRoomId('');
        setSelectedAssignedRoomNumber('');
        setApprovingBooking(false);

        try {
            const token = await getToken();
            const response = await axios.get(`${BACKEND_URL}/physical-rooms/available/${booking.room.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAvailablePhysicalRooms(response.data);
            setIsApproveModalOpen(true);
        } catch (err) {
            console.error('Failed to fetch available physical rooms:', err.response?.data || err.message);
            alert(`Failed to fetch available rooms: ${err.response?.data?.error || err.message}`);
        }
    };

    const handleCloseApproveModal = () => {
        setIsApproveModalOpen(false);
        setCurrentBookingToApprove(null);
        setAvailablePhysicalRooms([]);
        setSelectedPhysicalRoomId('');
        setSelectedAssignedRoomNumber('');
    };

    const handleConfirmApprove = async () => {
        if (!currentBookingToApprove || !selectedPhysicalRoomId || !selectedAssignedRoomNumber) {
            alert('Please select an available physical room.');
            return;
        }

        setApprovingBooking(true);
        try {
            const token = await getToken();
            await axios.patch(`${BACKEND_URL}/admin/bookings/${currentBookingToApprove.id}/approve`,
                {
                    physicalRoomId: selectedPhysicalRoomId,
                    assignedRoomNumber: selectedAssignedRoomNumber
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            alert('Booking approved and room assigned successfully!');
            fetchBookings();
            fetchWalkInBookings(); // Refresh walk-in bookings too
            handleCloseApproveModal();
        } catch (err) {
            console.error('Failed to approve booking:', err.response?.data || err.message);
            alert(`Failed to approve booking: ${err.response?.data?.error || err.message}`);
        } finally {
            setApprovingBooking(false);
        }
    };

    const handleShowDetails = (booking) => {
        // Calculate nights based on check-in and check-out
        const checkIn = parseMySQLDateTimeToLocal(booking.checkInDate || booking.checkInDateAndTime);
        const checkOut = parseMySQLDateTimeToLocal(booking.checkOutDate || booking.checkOutDateAndTime);
        const durationInHours = differenceInHours(checkOut, checkIn);
        const calculatedNights = durationInHours >= 22 ? Math.ceil(durationInHours / 24) : 1;

        // Add calculated nights to booking object
        const bookingWithNights = {
            ...booking,
            nights: calculatedNights,
        };

        setSelectedBookingDetails(bookingWithNights);
        setShowBookingDetailsModal(true);

        setSelectedUserEmail(booking.user?.email || 'N/A');
    };


    const handleShowWalkInDetails = (booking) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
};

    const handleCloseWalkInModal = () => {
        setIsModalOpen(false);
        setSelectedBooking(null); // Clear selected booking when closing
    };

    const handleCloseBookingDetailsModal = () => {
        setShowBookingDetailsModal(false);
        setSelectedBookingDetails(null);
    };
    // ====================================================================
    // NEW: Online Booking Cash Payment Logic
    // ====================================================================
    const handleCashClick = (booking) => {
        setCurrentOnlineBookingToPay(booking);
        setOnlinePaymentAmount('');
        setOnlinePaymentError(null);
        setIsCashModalOpen(true);
    };

    const handleCloseCashModal = () => {
        setIsCashModalOpen(false);
        setCurrentOnlineBookingToPay(null);
        setOnlinePaymentAmount('');
        setOnlinePaymentError(null);
    };

    const handleConfirmCashPayment = async () => {
        if (!currentOnlineBookingToPay || !onlinePaymentAmount) {
            setOnlinePaymentError('Please enter a payment amount.');
            return;
        }
        const amount = parseFloat(onlinePaymentAmount);
        if (isNaN(amount) || amount <= 0) {
            setOnlinePaymentError('Please enter a valid amount.');
            return;
        }

        // Logic for cash payment needs to be updated to handle partial vs full payment
        // We will assume a full payment is made here for simplicity.
        // A more robust implementation would check if the amount matches the total price.

        setProcessingOnlinePayment(true);
        setOnlinePaymentError(null);
        try {
            const token = await getToken();
             await axios.patch(
                `${BACKEND_URL}/admin/bookings/${currentOnlineBookingToPay.id}/pay-in-cash`,
                {}, // Send an empty body as the logic is handled on the backend
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            alert('Online booking paid in cash successfully!');
            fetchBookings(); // Refresh bookings to show updated status
            handleCloseCashModal();
        } catch (err) {
            console.error('Failed to process cash payment:', err.response?.data || err.message);
            setOnlinePaymentError(err.response?.data?.error || 'Failed to process cash payment.');
        } finally {
            setProcessingOnlinePayment(false);
        }
    };
    // ====================================================================
    // END: Online Booking Cash Payment Logic
    // ====================================================================

     //==========================================================================================
    //==========================================================================================
    //================         FOR WALK IN PAY NOW BUTTON           ============================
    //==========================================================================================
    //==========================================================================================

    const handlePayNowClick = (booking) => {
        setCurrentBookingToPay(booking);
        setPaymentAmount(''); // Clear previous amount
        setPaymentError(null); // Clear previous error
        setIsPayNowModalOpen(true);
    };

    const handleClosePayNowModal = () => {
        setIsPayNowModalOpen(false);
        setCurrentBookingToPay(null);
        setPaymentAmount('');
        setPaymentError(null);
    };

    const handleConfirmPayment = async () => {
        if (!currentBookingToPay || !paymentAmount) {
            setPaymentError('Please enter a payment amount.');
            return;
        }
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            setPaymentError('Please enter a valid amount.');
            return;
        }

        if (amount > (currentBookingToPay.totalPrice - currentBookingToPay.amountPaid)) {
            setPaymentError('Payment amount cannot exceed the remaining balance.');
            return;
        }

        setProcessingPayment(true);
        setPaymentError(null);
        try {
            const token = await getToken();
            await axios.patch(`${BACKEND_URL}/admin/bookings/walk-in/${currentBookingToPay.id}/record-payment`,
                { amountPaid: amount },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            alert('Payment recorded successfully!');
            fetchBookings();
            fetchWalkInBookings();
            handleClosePayNowModal();
        } catch (err) {
            console.error('Failed to record payment:', err.response?.data || err.message);
            setPaymentError(err.response?.data?.error || 'Failed to record payment.');
        } finally {
            setProcessingPayment(false);
        }
    };
    //==========================================================================================
    //==========================================================================================
    //================         END WALK IN PAY NOW BUTTON           ============================
    //==========================================================================================
    //==========================================================================================


    // Online Booking Extend Handlers
    const handleExtendBookingClick = (booking) => {
        setCurrentBookingToExtend(booking);
        const currentCheckout = parseMySQLDateTimeToLocal(booking.checkOutDate || booking.checkOutDateAndTime);
        currentCheckout.setDate(currentCheckout.getDate() + 1);
        setNewExtendCheckOutDate(currentCheckout.toISOString().split('T')[0]);
        setIsExtendModalOpen(true);
    };

    const handleCloseExtendModal = () => {
        setIsExtendModalOpen(false);
        setCurrentBookingToExtend(null);
        setNewExtendCheckOutDate('');
    };

    const handleConfirmExtend = async () => {
        if (!currentBookingToExtend || !newExtendCheckOutDate) {
            alert('Please select a new check-out date.');
            return;
        }

        const oldCheckOutDate = parseMySQLDateTimeToLocal(currentBookingToExtend.checkOutDate || currentBookingToExtend.checkOutDateAndTime);
        const newDate = new Date(newExtendCheckOutDate);

        if (newDate <= oldCheckOutDate) {
            alert('New check-out date must be after the current check-out date.');
            return;
        }

        setExtendingBooking(true);
        try {
            const token = await getToken();
            await axios.patch(`${BACKEND_URL}/admin/bookings/${currentBookingToExtend.id}/extend`,
                { newCheckOutDate: newExtendCheckOutDate },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            alert('Booking extended successfully!');
            fetchBookings();
            fetchWalkInBookings(); // Refresh walk-in bookings too
            handleCloseExtendModal();
        } catch (err) {
            console.error('Failed to extend booking:', err.response?.data || err.message);
            alert(`Failed to extend booking: ${err.response?.data?.error || err.message}`);
        } finally {
            setExtendingBooking(false);
        }
    };

    // Online Booking Checkout Handlers

    const handleCheckoutBookingClick = (booking) => {
        setCurrentBookingToCheckout(booking);
        setIsCheckoutConfirmModalOpen(true);
    };

    const handleCloseCheckoutConfirmModal = () => {
        setIsCheckoutConfirmModalOpen(false);
        setCurrentBookingToCheckout(null);
    };

    const handleConfirmCheckout = async () => {
        if (!currentBookingToCheckout) return;

        setCheckingOutBooking(true);
        try {
            const token = await getToken();
            await axios.patch(`${BACKEND_URL}/admin/bookings/${currentBookingToCheckout.id}/checkout`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Booking marked as checked out!');
            fetchBookings();
            fetchWalkInBookings(); // Refresh walk-in bookings too
            handleCloseCheckoutConfirmModal();
        } catch (err) {
            console.error('Failed to check out booking:', err.response?.data || err.message);
            alert(`Failed to check out booking: ${err.response?.data?.error || err.message}`);
        } finally {
            setCheckingOutBooking(false);
        }
    };

    // ====================================================================
    // NEW: Walk-In Specific Extend and Checkout Logic
    // ====================================================================

    const handleExtendWalkInBookingClick = (booking) => {
        setCurrentWalkInBookingToExtend(booking);
        setWalkInNightsToExtend(1); // Default to 1 night
        setWalkInPaymentAmount(0); // Default to 0 payment
        setWalkInExtendError(''); // Changed from null to ''
        setIsExtendWalkInModalOpen(true);
    };

    const handleCloseExtendWalkInModal = () => {
        setIsExtendWalkInModalOpen(false);
        setCurrentWalkInBookingToExtend(null);
        setWalkInNightsToExtend(1);
        setWalkInPaymentAmount(0);
        setWalkInExtendError(''); // Changed from null to ''
    };

    const handleConfirmWalkInExtend = async () => {
        if (!currentWalkInBookingToExtend || walkInNightsToExtend <= 0 || isNaN(walkInNightsToExtend) || isNaN(walkInPaymentAmount)) {
            setWalkInExtendError('Please enter valid nights to extend and payment amount.');
            return;
        }

        setExtendingWalkInBooking(true);
        setWalkInExtendError(''); // Changed from null to ''
        try {
            const token = await getToken();
            await axios.patch(`${BACKEND_URL}/admin/bookings/walk-in/${currentWalkInBookingToExtend.id}/extend`,
                {
                    nightsToExtend: walkInNightsToExtend,
                    paymentAmount: walkInPaymentAmount
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            alert('Walk-in booking extended successfully!');
            fetchWalkInBookings(); // Only refresh walk-in bookings
            handleCloseExtendWalkInModal();
        } catch (err) {
            console.error('Failed to extend walk-in booking:', err.response?.data || err.message);
            setWalkInExtendError(err.response?.data?.error || 'Failed to extend walk-in booking.');
        } finally {
            setExtendingWalkInBooking(false);
        }
    };

    const handleCheckoutWalkInClick = (booking) => {
        setCurrentWalkInBookingToCheckout(booking);
        setIsCheckoutWalkInConfirmModalOpen(true);
    };

    const handleCloseCheckoutWalkInConfirmModal = () => {
        setIsCheckoutWalkInConfirmModalOpen(false);
        setCurrentWalkInBookingToCheckout(null);
    };

    const handleConfirmWalkInCheckout = async () => {
        if (!currentWalkInBookingToCheckout) return;

        setCheckingOutWalkInBooking(true);
        try {
            const token = await getToken();
            await axios.patch(`${BACKEND_URL}/admin/bookings/walk-in/${currentWalkInBookingToCheckout.id}/checkout`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Walk-in booking marked as checked out!');
            fetchWalkInBookings(); // Only refresh walk-in bookings
            handleCloseCheckoutWalkInConfirmModal();
        } catch (err) {
            console.error('Failed to check out walk-in booking:', err.response?.data || err.message);
            alert(`Failed to check out walk-in booking: ${err.response?.data?.error || err.message}`);
        } finally {
            setCheckingOutWalkInBooking(false);
        }
    };

     const handlePrintOnlineBookingReceipt = (booking) => {
        // Calculate nights using the same logic as the backend for consistency
        const checkInDateObj = parseMySQLDateTimeToLocal(booking.checkInDate || booking.checkInDateAndTime);
        const checkOutDateObj = parseMySQLDateTimeToLocal(booking.checkOutDate || booking.checkOutDateAndTime);

        
        let nights = 'N/A';
        const durationInHours = differenceInHours(checkOutDateObj, checkInDateObj);
        if (durationInHours >= 22) {
        nights = Math.ceil(durationInHours / 24); // Round up to count full days
        }


        const totalRoomCharge = (parseFloat(booking.roomPrice || 0) * parseInt(nights || 0)).toFixed(2);
        const lateCheckOutFee = parseFloat(booking.lateCheckOutFee || 0).toFixed(2);
        const earlyCheckInFee = parseFloat(booking.earlyCheckInFee || 0).toFixed(2);
        const totalPrice = parseFloat(booking.totalPrice).toFixed(2);
        const amountPaid = parseFloat(booking.amountPaid || 0).toFixed(2);
        const balanceDue = (parseFloat(booking.totalPrice) - parseFloat(booking.amountPaid || 0)).toFixed(2);

        // Determine the payment status string
        const paymentStatusDisplay = booking.isPaid ? 'Paid' : 'Not Paid';

        // Use actual check-in/out times for display with fallback
        const displayCheckInDate = booking.actual_check_in_time || booking.checkInDate || booking.checkInDateAndTime;
        const displayCheckOutDate = booking.actual_check_out_time || booking.checkOutDate || booking.checkOutDateAndTime;

        // Helper function to format date or show "N/A"
        const formatDate = (dateValue) => {
            const date = parseMySQLDateTimeToLocal(dateValue);
            return date ? date.toLocaleString() : 'N/A';
        };

        const receiptHtml = `
            <html>
            <head>
                <title> </title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; margin: 0; padding: 0; background-color: #fff; }
                    .receipt-container { width: 300px; margin: 20px auto; padding: 15px; border: 1px solid #555; }
                    h2 { text-align: center; margin-top: 0; margin-bottom: 15px; font-size: 18px; }
                    .company-name { font-weight: bold; font-size: 20px; }
                    .info { text-align: center; font-size: 10px; margin-bottom: 15px; }
                    .item { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
                    .item span:first-child { text-align: left; padding-right: 10px; }
                    .item span:last-child { text-align: right; font-weight: bold; }
                    hr { border: 0; border-top: 1px dashed #777; margin: 10px 0; }
                    .total-section .item span:last-child { font-size: 14px; }
                    .footer { text-align: center; margin-top: 15px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    <h2 class="company-name">Sanjh Island Hotel</h2>
                    <div class="info">
                       Morente Avenue, Bagumbayan, Roxas, Oriental Mindoro, PH<br>
                        Phone: (043) 738-3767 <br> Email: sanjhisland@gmail.com
                    </div>
                    <hr>
                    <p class="item"><span>Receipt No:</span> <span>BK${booking.id}</span></p>
                    <p class="item"><span>Date:</span> <span>${new Date().toLocaleString()}</span></p>
                    <hr>
                    <p class="item"><span>Guest:</span> <span>${booking.user.firstName} ${booking.user.lastName}</span></p>
                    <p class="item"><span>Room Type:</span> <span>${booking.room.roomType}</span></p>
                    <p class="item"><span>Room No:</span> <span>${booking.physicalRoomNumber || 'N/A'}</span></p>

                    <p class="item"><span>Check-in:</span> <span>${formatDate(displayCheckInDate)}</span></p>
                    <p class="item"><span>Check-out:</span> <span>${formatDate(displayCheckOutDate)}</span></p>

                    <hr>
                    <p class="item"><span>Nights:</span> <span>${nights}</span></p>
                    <p class="item"><span>Price/Night:</span> <span>₱${parseFloat(booking.room.price || 0).toFixed(2)}</span></p>
                    <p class="item"><span>Total Room Charge:</span> <span>₱${totalRoomCharge}</span></p>
                    <p class="item"><span>Late Check-out Fee:</span> <span>₱${lateCheckOutFee}</span></p>
                    <p class="item"><span>Early Check-in Fee:</span> <span>₱${earlyCheckInFee}</span></p>
                    <hr>
                    <div class="total-section">
                        <p class="item"><span>TOTAL AMOUNT DUE:</span> <span>₱${totalPrice}</span></p><hr>
                        <p class="item"><span>AMOUNT PAID:</span> <span>₱${amountPaid}</span></p>
                        <p class="item"><span>BALANCE:</span> <span>₱${balanceDue}</span></p>
                        <p class="item"><span>Payment Status:</span> <span>${paymentStatusDisplay}</span></p>
                    </div>
                    <hr>
                    <p class="footer">Thank you for choosing Sanjh Island Hotel!<br>Please come again.</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', 'width=1000,height=650,scrollbars=yes,resizable=yes');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        } else {
            alert("Pop-up blocked. Please allow pop-ups for this site to print the receipt.");
        }
    };

     // ====================================================================
    // NEW: Walk-In Receipt Printing Logic (Modified for lateCheckOutFee)
    // ====================================================================
    const handlePrintWalkInReceipt = (booking) => {
        // Use the 'nights' value directly from the booking object as it's now sent from backend
        const nights = booking.nights;

        const totalRoomCharge = (parseFloat(booking.roomPrice || 0) * parseInt(nights || 0)).toFixed(2);
        const lateCheckOutFee = parseFloat(booking.lateCheckOutFee || 0).toFixed(2); // Get late check-out fee
        const earlyCheckInFee = parseFloat(booking.earlyCheckInFee || 0).toFixed(2);
        const totalPrice = parseFloat(booking.totalPrice).toFixed(2);
        const amountPaid = parseFloat(booking.amountPaid || 0).toFixed(2);
        const balanceDue = (parseFloat(booking.totalPrice) - parseFloat(booking.amountPaid || 0)).toFixed(2);

        const receiptHtml = `
            <html>
            <head>
                <title> </title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; margin: 0; padding: 0; background-color: #fff; }
                    .receipt-container { width: 300px; margin: 20px auto; padding: 15px; border: 1px solid #555; }
                    h2 { text-align: center; margin-top: 0; margin-bottom: 15px; font-size: 18px; }
                    .company-name { font-weight: bold; font-size: 20px; }
                    .info { text-align: center; font-size: 10px; margin-bottom: 15px; }
                    .item { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
                    .item span:first-child { text-align: left; padding-right: 10px; }
                    .item span:last-child { text-align: right; font-weight: bold; }
                    hr { border: 0; border-top: 1px dashed #777; margin: 10px 0; }
                    .total-section .item span:last-child { font-size: 14px; }
                    .footer { text-align: center; margin-top: 15px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    <h2 class="company-name">Sanjh Island Hotel</h2>
                    <div class="info">
                       Morente Avenue, Bagumbayan, Roxas, Oriental Mindoro, PH<br>
                        Phone: (043) 738-3767 <br> Email: sanjhisland@gmail.com
                    </div>
                    <hr>
                    <p class="item"><span>Receipt No:</span> <span>BK${booking.id}</span></p>
                    <p class="item"><span>Date:</span> <span>${new Date().toLocaleString()}</span></p>
                    <hr>
                    <p class="item"><span>Guest:</span> <span>${booking.firstName} ${booking.lastName}</span></p>
                    <p class="item"><span>Room Type:</span> <span>${booking.roomType}</span></p>
                    <p class="item"><span>Room No:</span> <span>${booking.physicalRoomNumber || 'N/A'}</span></p>
                    <p class="item"><span>Check-in:</span> <span>${formatLocalDateTime(booking.checkInDateAndTime || booking.checkInDate)}</span></p>
                    <p class="item"><span>Check-out:</span> <span>${formatLocalDateTime(booking.checkOutDateAndTime || booking.checkOutDate)}</span></p>
                    <hr>
                    <p class="item"><span>Nights:</span> <span>${nights}</span></p>
                    <p class="item"><span>Price/Night:</span> <span>₱${parseFloat(booking.roomPrice || 0).toFixed(2)}</span></p>
                    <p class="item"><span>Late Check-out Fee:</span> <span>₱${lateCheckOutFee}</span></p> <!-- NEW: Late Check-out Fee -->
                    <p class="item"><span>Early Check-in Fee:</span> <span>₱${earlyCheckInFee}</span></p>
                    <p class="item"><span>Total Room Charge:</span> <span>₱${totalRoomCharge}</span></p>
                    <hr>
                    <div class="total-section">
                        <p class="item"><span>TOTAL AMOUNT DUE:</span> <span>₱${totalPrice}</span></p><hr>
                        <p class="item"><span>AMOUNT PAID:</span> <span>₱${amountPaid}</span></p>
                        <p class="item"><span>BALANCE:</span> <span>₱${balanceDue}</span></p>
                        <p class="item"><span>Payment Status:</span> <span>${booking.isPaid}</span></p>
                    </div>
                    <hr>
                    <p class="footer">Thank you for choosing Sanjh Island Hotel!<br>Please come again.</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', 'width=1000,height=650,scrollbars=yes,resizable=yes');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
            printWindow.focus();
             // Delay print to ensure content is loaded, especially images if any were added
            setTimeout(() => {
                printWindow.print();
                // printWindow.close(); // Optional: close after printing, user might want to keep it open
            }, 500);
        } else {
            alert("Pop-up blocked. Please allow pop-ups for this site to print the receipt.");
        }
    };


    if (!isLoaded || !isSignedIn) {
        return <div className="p-8 text-center">Loading dashboard...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    }

    // Filter out checked-out online bookings
    const activeOnlineBookings = (dashboardData.bookings || []).filter(
        (booking) => booking.status !== 'checked_out'
    );

    // Filter out checked-out walk-in bookings
    // IMPORTANT: Double-check your database for the exact status string for checked-out walk-in bookings.
    // It is often 'Checked-Out' (capital 'O') or 'checked_out'. I'm using 'Checked-Out' here.
    const activeWalkInBookings = (walkInBookingsData || []).filter(
        (booking) => booking.status !== 'Checked-Out'
    );

    return (
        <div className="p-6 md:p-8 lg:p-10 bg-gray-50 min-h-screen">
            <h1 className="text-3xl md:text-4xl font-playfair mb-8 text-gray-800">Admin Dashboard</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
                    <div>
                        <p className="text-lg text-gray-500">Total Users</p>
                        <p className="text-3xl font-bold text-gray-900">{dashboardData.totalUsers}</p>
                    </div>
                    <i className="fas fa-users text-4xl text-blue-500"></i>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
                    <div>
                        <p className="text-lg text-gray-500">Total Rooms</p>
                        <p className="text-3xl font-bold text-gray-900">{dashboardData.totalRooms}</p>
                    </div>
                    <i className="fas fa-bed text-4xl text-green-500"></i>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
                    <div>
                        <p className="text-lg text-gray-500">Total Bookings</p>
                        <p className="text-3xl font-bold text-gray-900">{dashboardData.totalBookings}</p>
                    </div>
                    <i className="fas fa-book-open text-4xl text-purple-500"></i>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
                    <div>
                        <p className="text-lg text-gray-500">Total Revenue</p>
                        <p className="text-3xl font-bold text-gray-900">₱{dashboardData.totalRevenue}</p>
                    </div>
                    <i className="fas fa-peso-sign text-4xl text-yellow-500"></i>
                </div>
            </div>

            {/* Bookings Section */}
            <h2 className="text-2xl font-playfair mb-4 text-gray-800">Recent Online Bookings</h2>
<div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto mb-10">
    {loading ? (
        <p className="text-center py-4">Loading bookings...</p>
    ) : (
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room No.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late Check-out Fee</th> {/* NEW COLUMN */}
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Paid</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                    {activeOnlineBookings.map((booking) =>  { // Added defensive check
                    // Calculate number of nights and room price for display
                    const checkOutDateObj = parseMySQLDateTimeToLocal(booking.checkOutDate || booking.checkOutDateAndTime);

                    // Determine if the booking is overdue:
                    // It must be past its checkout date AND its status must be 'approved'.
                    const now = new Date();
                    const isOverdue = checkOutDateObj < now && booking.status === 'approved';

                    return (
                        <tr key={booking.id} className={
                            isOverdue ? 'bg-red-200' : // Darker red for overdue
                            booking.isApproachingCheckout ? 'bg-yellow-50' : ''
                        }>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                <button
                                    onClick={() => handleViewUserDetails(booking.userId)}
                                    className="text-blue-600 hover:underline cursor-pointer"
                                    disabled={fetchingUserDetails}
                                >
                                    {booking.user.firstName} {booking.user.lastName}
                                </button>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{booking.room.roomType}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{booking.physicalRoomNumber || 'N/A'}</td> {/* Changed to physicalRoomNumber */}
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">₱{parseFloat(booking.lateCheckOutFee || 0).toFixed(2)}</td> {/* Display Late Check-out Fee */}
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">₱{booking.totalPrice.toFixed(2)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">₱{parseFloat(booking.amountPaid || 0).toFixed(2)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                                <span className={`px-2 inline-flex text-xs leading-5 rounded-full ${
                                    booking.isPaid === 'Fully Paid' ? 'bg-green-100 text-green-800' : booking.isPaid === 'Partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                }`}>
                                    {booking.isPaid || 'Not Paid'}
                                </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">₱{(parseFloat(booking.totalPrice || 0) - parseFloat(booking.amountPaid || 0)).toFixed(2)}</td>


                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        booking.isPaid === 'Fully Paid'
                                            ? 'bg-green-100 text-green-800'
                                            : booking.isPaid === 'Partial'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-red-100 text-red-800'
                                    }`}
                                >
                                    {booking.isPaid || 'Not Paid'}
                                </span>
                            </td>

                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                    ${isOverdue ? 'bg-red-400 text-white' : // Overdue
                                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    booking.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                    booking.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    booking.status === 'checked_out' ? 'bg-gray-100 text-gray-800' :
                                    booking.status === 'Extended' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'}`}>
                                    {isOverdue ? 'OVERDUE' : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                </span>
                                {booking.isApproachingCheckout && booking.status === 'approved' && !isOverdue && ( // Only show if not already overdue
                                    <p className="text-yellow-600 text-xs mt-1 font-semibold">Approaching Checkout!</p>
                                )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                                {booking.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => handleApproveClick(booking)}
                                            className="text-green-600 hover:text-green-900 mr-2 cursor-pointer"
                                            disabled={loading}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleRejectClick(booking)}
                                            className="text-red-600 hover:text-red-900 cursor-pointer"
                                            disabled={loading}
                                        >
                                            Reject
                                        </button>
                                    </>
                                )}
                                {booking.status === 'approved' && (
                                    <button
                                        onClick={() => handleExtendBookingClick(booking)}
                                        className="text-purple-600 hover:text-purple-900 mr-2 cursor-pointer"
                                        disabled={loading}
                                    >
                                        Extend
                                    </button>
                                )}
                                {booking.status === 'approved' && booking.isPaid && (
                                    <button
                                        onClick={() => handleCheckoutBookingClick(booking)}
                                        className="text-indigo-600 hover:text-indigo-900 cursor-pointer"
                                        disabled={loading}
                                    >
                                        Check Out
                                    </button>
                                )}

                                {booking.status === 'rejected' && (
                                    <span className="text-gray-500">Rejected</span>
                                )}
                                {booking.status === 'checked_out' && (
                                    <span className="text-gray-500">Checked Out</span>
                                )}
                            </td>

                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                        <button
                                            onClick={() => handleShowDetails(booking)}
                                            className="text-indigo-600 hover:text-indigo-900 mr-2 cursor-pointer"
                                            disabled={loading}
                                        >
                                            View Details
                                        </button>
                                        
                                        {booking.status === 'approved'  && (
                                                <button
                                                    onClick={() => handleCashClick(booking)}
                                                    className="text-green-600 hover:text-green-900 mr-2 cursor-pointer"
                                                    disabled={loading}
                                                >
                                                    Cash
                                                </button>
                                            )}

                                {booking.status === 'approved' && booking.isPaid && (
                                        <button
                                            onClick={() => handlePrintOnlineBookingReceipt(booking)}
                                            className="text-blue-600 hover:text-blue-900 mr-2 cursor-pointer"
                                            disabled={loading}
                                        >
                                            Receipt
                                        </button>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    )}
</div>

                            {/* NEW: Recent Walk-in Bookings Section */}
                            <h2 className="text-2xl font-playfair mb-4 text-gray-800">Recent Walk-in Bookings</h2>
                            <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto mb-10">
                                {loading ? (
                                    <p className="text-center py-4">Loading walk-in bookings...</p>
                                ) : (
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest Name</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room Type</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room No.</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in Date/Time</th> {/* ADDED THIS HEADER */}
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-out Date/Time</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nights</th> {/* ADDED THIS HEADER */}
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Status</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Paid</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Status</th>
                                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {activeWalkInBookings.map((booking) => { // Added defensive check
                                                const balance = parseFloat(booking.totalPrice) - parseFloat(booking.amountPaid || 0); // Calculate balance

                                                // Determine the background color based on isPaid status and overdue status
                                                const checkOutDateTime = parseMySQLDateTimeToLocal(booking.checkOutDateAndTime || booking.checkOutDate);
                                                const now = new Date();
                                                const isOverdue = checkOutDateTime < now && booking.status !== 'Checked-Out';

                                                // Dynamically determine the row background color based on balance and overdue status
                                                let rowBackgroundColorClass = '';
                                                if (isOverdue) {
                                                    rowBackgroundColorClass = 'bg-red-200';
                                                } else if (balance <= 0) {
                                                    rowBackgroundColorClass = 'bg-green-50';
                                                } else if (parseFloat(booking.amountPaid || 0) > 0) {
                                                    rowBackgroundColorClass = 'bg-yellow-50';
                                                } else {
                                                    rowBackgroundColorClass = 'bg-red-50';
                                                }

                                                // Dynamically determine the paid status based on the current balance
                                                let dynamicPaidStatus;
                                                if (balance <= 0) {
                                                    dynamicPaidStatus = 'Fully Paid';
                                                } else if (parseFloat(booking.amountPaid || 0) > 0) {
                                                    dynamicPaidStatus = 'Partial';
                                                } else {
                                                    dynamicPaidStatus = 'Not Paid';
                                                }

                                                return (
                                                    <tr key={booking.id} className={`${rowBackgroundColorClass}`}>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{booking.id}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                            <span
                                                                className="text-indigo-600 hover:text-indigo-900 cursor-pointer"
                                                                onClick={() => handleViewWalkInUserDetails(booking.id)}
                                                                disabled={fetchingWalkInUserDetails}>
                                                                {booking.firstName} {booking.lastName}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{booking.roomType}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{booking.physicalRoomNumber || 'N/A'}</td> {/* Displaying physicalRoomNumber */}
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                            {/* Display check-in date/time for walk-ins */}
                                                            {formatLocalDateTime(booking.checkInDateAndTime || booking.checkInDate)}
                                                        </td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                            {/* Always use toLocaleString for dates that might have time */}
                                                            {formatLocalDateTime(booking.checkOutDateAndTime || booking.checkOutDate)}
                                                        </td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                            {/* Display nights for walk-ins */}
                                                            {booking.nights || 'N/A'}
                                                        </td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">₱{parseFloat(booking.totalPrice).toFixed(2)}</td>

                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                            ${dynamicPaidStatus === 'Fully Paid' ? 'bg-green-100 text-green-800' :
                                                            dynamicPaidStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-red-100 text-red-800'}`}>
                                                            {dynamicPaidStatus}
                                                        </span>
                                                        </td>

                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-green-800 font-bold">₱{parseFloat(booking.amountPaid).toFixed(2)}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600 font-bold ">₱{balance.toFixed(2)}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                                                ${checkOutDateTime < now && booking.status !== 'Checked-Out' ? 'bg-red-400 text-white' : // Overdue
                                                                booking.status === 'Checked-In' ? 'bg-green-100 text-green-800' : // Green for Checked-In
                                                                booking.status === 'Checked-Out' ? 'bg-gray-100 text-gray-800' :   // Gray for Checked-Out
                                                                booking.status === 'Extended' ? 'bg-purple-100 text-purple-800' : // NEW: Extended status color
                                                                'bg-gray-100 text-gray-800'}`}> {/* Default fallback for any other status */}
                                                                {checkOutDateTime < now && booking.status !== 'Checked-Out' ? 'OVERDUE' : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">

                                                            {balance > 0 && (
                                                                <button
                                                                    onClick={() => handlePayNowClick(booking)}
                                                                    className="text-green-600 hover:text-green-900 mr-2 cursor-pointer"
                                                                >
                                                                    Pay Now
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => handleExtendWalkInBookingClick(booking)}
                                                                className="text-indigo-600 hover:text-purple-900 mr-2 cursor-pointer"
                                                            >
                                                                Extend
                                                            </button>

                                                            {balance.toFixed(2) === '0.00' && booking.status !== 'Checked-Out' && (
                                                                <button
                                                                    onClick={() => handleCheckoutWalkInClick(booking)}
                                                                    className="text-red-600 hover:text-indigo-900 cursor-pointer"
                                                                >
                                                                    Check-Out
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                            {parseFloat(booking.amountPaid || 0) > 0 && (
                                                                <button
                                                                    onClick={() => handlePrintWalkInReceipt(booking)}
                                                                    className="text-blue-600 hover:text-blue-900 cursor-pointer"
                                                                >
                                                                    Receipt
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                                        onClick={() => handleShowWalkInDetails(booking)}
                                                                        className="text-indigo-600 hover:text-indigo-900 mr-2 cursor-pointer"
                                                                        disabled={loading}
                                                                    >
                                                                        View Details
                                                                    </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

            {isPayNowModalOpen && currentBookingToPay && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Record Payment for Booking #{currentBookingToPay.id}</h3>
                        <p className="mb-2">
                            Guest: <strong>{currentBookingToPay.firstName} {currentBookingToPay.lastName}</strong>
                        </p>
                        <p className="mb-2">
                            Total Price: <strong>₱{parseFloat(currentBookingToPay.totalPrice).toFixed(2)}</strong>
                        </p>
                        <p className="mb-4">
                            Amount Paid: <strong>₱{parseFloat(currentBookingToPay.amountPaid || 0).toFixed(2)}</strong>
                        </p>
                        <p className="mb-4 text-lg font-bold text-blue-700">
                            Balance Due: ₱{(parseFloat(currentBookingToPay.totalPrice) - parseFloat(currentBookingToPay.amountPaid || 0)).toFixed(2)}
                        </p>
                        <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700 mb-2">
                            Amount to Pay:
                        </label>
                        <input
                            type="number"
                            id="paymentAmount"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter amount"
                            min="0.01"
                            step="0.01"
                        />
                        {paymentError && <p className="text-red-500 text-sm mt-2">{paymentError}</p>}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={handleClosePayNowModal}
                                className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmPayment}
                                className="px-5 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition duration-200 ease-in-out"
                                disabled={processingPayment}
                            >
                                {processingPayment ? 'Processing...' : 'Confirm Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Start of Cash Payment Modal (Online Bookings) */}
            {isCashModalOpen && currentOnlineBookingToPay && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4">
                        <h3 className="text-xl font-bold mb-4">Record Cash Payment</h3>
                        <p className="mb-2">Booking ID: {currentOnlineBookingToPay.id}</p>
                        <p className="mb-4">Balance: ₱{(parseFloat(currentOnlineBookingToPay.totalPrice) - parseFloat(currentOnlineBookingToPay.amountPaid || 0)).toFixed(2)}</p>
                        <div className="mb-4">
                            <label htmlFor="onlinePaymentAmount" className="block text-sm font-medium text-gray-700">Amount to Pay</label>
                            <input
                                type="number"
                                id="onlinePaymentAmount"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 p-2 focus:ring-indigo-200 focus:ring-opacity-50"
                                value={onlinePaymentAmount}
                                onChange={(e) => setOnlinePaymentAmount(e.target.value)}
                                placeholder="Enter amount"
                            />
                            {onlinePaymentError && <p className="mt-2 text-sm text-red-600">{onlinePaymentError}</p>}
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={handleCloseCashModal}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmCashPayment}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                disabled={processingOnlinePayment}
                            >
                                {processingOnlinePayment ? 'Processing...' : 'Record Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* End of Cash Payment Modal */}

            {showWalkInUserDetailsModal && selectedWalkInUserDetails && (
  <div className="fixed inset-0 bg-gray-800 bg-opacity-60 flex items-center justify-center z-50 p-4 sm:p-6">
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 opacity-100">
      <h3 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">User Details</h3>

      {fetchingWalkInUserDetails ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-600 text-lg">Loading user details...</p>
        </div>
      ) : userWalkInDetailsError ? (
        <div className="text-red-600 bg-red-50 p-4 rounded-lg text-center">
          <p className="font-medium">Error:</p>
          <p>{userWalkInDetailsError}</p>
        </div>
      ) : (
        <>
          <div className="space-y-4 text-gray-700 text-base">
            <p>
              <strong className="font-semibold text-gray-900">First Name:</strong>{" "}
              {selectedWalkInUserDetails.first_name}
            </p>
            <p>
              <strong className="font-semibold text-gray-900">Last Name:</strong>{" "}
              {selectedWalkInUserDetails.last_name}
            </p>
            <p>
              <strong className="font-semibold text-gray-900">Email:</strong>{" "}
              {selectedWalkInUserDetails.email || "N/A"}
            </p>
            <p>
              <strong className="font-semibold text-gray-900">Phone:</strong>{" "}
              {selectedWalkInUserDetails.phone || "N/A"}
            </p>

            {selectedWalkInUserDetails.id_picture_url && (
              <p className="mt-5 pt-4 border-t border-gray-200">
                <strong className="font-semibold text-gray-900">Valid ID:</strong>{" "}
                <a
                  href={`${BACKEND_URL}${selectedWalkInUserDetails.id_picture_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 border border-solid p-1 rounded-full transition duration-200 ease-in-out"
                >
                  View Valid ID
                </a>
              </p>
            )}
          </div>

          <div className="flex justify-end mt-8 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCloseWalkInUserDetailsModal}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-200 ease-in-out text-base font-medium cursor-pointer"
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}
            {/* Extend Booking Modal (Online) */}
            {isExtendModalOpen && currentBookingToExtend && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Extend Booking</h3>
                        <p className="mb-2">
                            Booking ID: <strong>{currentBookingToExtend.id}</strong>
                        </p>
                        <p className="mb-4">
                            Current Check-out: <strong>{parseMySQLDateTimeToLocal(currentBookingToExtend.checkOutDate || currentBookingToExtend.checkOutDateAndTime)?.toLocaleDateString() || 'N/A'}</strong>
                        </p>
                        <label htmlFor="newCheckoutDate" className="block text-sm font-medium text-gray-700 mb-2">
                            New Check-out Date:
                        </label>
                        <input
                            type="date"
                            id="newCheckoutDate"
                            value={newExtendCheckOutDate}
                            onChange={(e) => setNewExtendCheckOutDate(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            min={(function(){
                                const base = parseMySQLDateTimeToLocal(currentBookingToExtend.checkOutDate || currentBookingToExtend.checkOutDateAndTime);
                                if (!base) return '';
                                const next = new Date(base);
                                next.setDate(next.getDate() + 1);
                                return next.toISOString().split('T')[0];
                            })()}
                        />
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={handleCloseExtendModal}
                                className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmExtend}
                                className="px-5 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 ease-in-out"
                                disabled={extendingBooking}
                            >
                                {extendingBooking ? 'Extending...' : 'Confirm Extend'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Check-out Confirmation Modal (Online) */}
            {isCheckoutConfirmModalOpen && currentBookingToCheckout && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Confirm Check-out</h3>
                        <p className="mb-2 text-sm text-gray-600">
                            Are you sure you want to mark booking <strong>{currentBookingToCheckout.id}</strong> as checked out?
                        </p>
                        <p className="mb-4 text-sm text-gray-600">
                            This will mark the assigned physical room ({currentBookingToCheckout.physicalRoomNumber || 'N/A'}) as 'available'.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCloseCheckoutConfirmModal}
                                className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCheckout}
                                className="px-5 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 ease-in-out"
                                disabled={checkingOutBooking}
                            >
                                {checkingOutBooking ? 'Checking Out...' : 'Confirm Check Out'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: Extend Walk-In Booking Modal */}
            {isExtendWalkInModalOpen && currentWalkInBookingToExtend && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Extend Walk-In Booking #{currentWalkInBookingToExtend.id}</h3>
                        <p className="mb-2">
                            Guest: <strong>{currentWalkInBookingToExtend.firstName} {currentWalkInBookingToExtend.lastName}</strong>
                        </p>
                        <p className="mb-2">
                            Current Check-out: <strong>{formatLocalDateTime(currentWalkInBookingToExtend.checkOutDateAndTime || currentWalkInBookingToExtend.checkOutDate)}</strong>
                        </p>
                        <p className="mb-4">
                            Current Total Price: <strong>₱{parseFloat(currentWalkInBookingToExtend.totalPrice).toFixed(2)}</strong>
                        </p>
                        <p className="mb-4">
                            Current Amount Paid: <strong>₱{parseFloat(currentWalkInBookingToExtend.amountPaid).toFixed(2)}</strong>
                        </p>
                        <p className="mb-4 text-lg font-bold text-blue-700">
                            Balance Due: ₱{(parseFloat(currentWalkInBookingToExtend.totalPrice) - parseFloat(currentWalkInBookingToExtend.amountPaid)).toFixed(2)}
                        </p>

                        <label htmlFor="walkInNightsToExtend" className="block text-sm font-medium text-gray-700 mb-2">
                            Nights to Extend:
                        </label>
                        <input
                            type="number"
                            id="walkInNightsToExtend"
                            value={walkInNightsToExtend}
                            onChange={(e) => setWalkInNightsToExtend(parseInt(e.target.value) || 0)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            min="1"
                            step="1"
                        />

                        <label htmlFor="walkInPaymentAmount" className="block text-sm font-medium text-gray-700 mt-4 mb-2">
                            Amount Paid for Extension:
                        </label>
                        <input
                            type="number"
                            id="walkInPaymentAmount"
                            value={walkInPaymentAmount === 0 ? '' : walkInPaymentAmount}
                            onChange={(e) => {
                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                setWalkInPaymentAmount(parseFloat(value) || 0)}}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0"
                            min="0"
                            step="0.01"
                        />
                        {walkInExtendError && <p className="text-red-500 text-sm mt-2">{walkInExtendError}</p>}

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={handleCloseExtendWalkInModal}
                                className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmWalkInExtend}
                                className="px-5 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200 ease-in-out"
                                disabled={extendingWalkInBooking}
                            >
                                {extendingWalkInBooking ? 'Extending...' : 'Confirm Extend'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: Checkout Walk-In Confirmation Modal */}
            {isCheckoutWalkInConfirmModalOpen && currentWalkInBookingToCheckout && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Confirm Walk-In Check-out</h3>
                        <p className="mb-2 text-sm text-gray-600">
                            Are you sure you want to mark walk-in booking <strong>{currentWalkInBookingToCheckout.id}</strong> as checked out?
                        </p>
                        <p className="mb-4 text-sm text-gray-600">This will mark the assigned physical room ({currentWalkInBookingToCheckout.physicalRoomNumber || 'N/A'}) as 'available'.</p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCloseCheckoutWalkInConfirmModal}
                                className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmWalkInCheckout}
                                className="px-5 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 ease-in-out"
                                disabled={checkingOutWalkInBooking}
                            >
                                {checkingOutWalkInBooking ? 'Checking Out...' : 'Confirm Check Out'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Users Section */}
            <h2 className="text-2xl font-playfair mb-4 text-gray-800">Registered Users</h2>
            <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
                {loading ? (
                    <p className="text-center py-4">Loading users...</p>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {(dashboardData.users || []).map((user) => ( // Added defensive check
                                <tr key={user.id}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.firstName} {user.lastName}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.phone_number || 'N/A'}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{user.gender}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* User Details Modal */}
            {showUserDetailsModal && selectedUserDetails && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative">
                        <button
                            onClick={handleCloseUserDetailsModal}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold"
                            aria-label="Close user details modal"
                        >
                            &times;
                        </button>
                        <h3 className="text-2xl font-playfair mb-4 text-gray-800">User Details</h3>
                        {fetchingUserDetails ? (
                            <p>Loading user details...</p>
                        ) : userDetailsError ? (
                            <p className="text-red-500">{userDetailsError}</p>
                        ) : (
                            <div>
                                <p><strong>Clerk ID:</strong> {selectedUserDetails.clerk_user_id}</p>
                                <p><strong>Name:</strong> {selectedUserDetails.first_name} {selectedUserDetails.last_name}</p>
                                <p><strong>Email:</strong> {selectedUserDetails.email}</p>
                                <p><strong>Phone Number:</strong> {selectedUserDetails.phone_number || 'N/A'}</p>
                                <p><strong>Gender:</strong> {selectedUserDetails.gender}</p>
                                <p><strong>Birth Date:</strong> {new Date(selectedUserDetails.birth_date).toLocaleDateString()}</p>
                                <p><strong>Address:</strong> {selectedUserDetails.address}</p>
                                {selectedUserDetails.id_picture_url && (
                                    <p>
                                        <strong>ID Picture:</strong>{' '}
                                        <a
                                            href={`${BACKEND_URL}${selectedUserDetails.id_picture_url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline"
                                        >
                                            View ID
                                        </a>
                                    </p>
                                )}
                                <p className="text-sm text-gray-500 mt-4">
                                    <small>Profile Created: {new Date(selectedUserDetails.created_at).toLocaleString()}</small><br/>
                                    <small>Last Updated: {new Date(selectedUserDetails.updated_at).toLocaleString()}</small>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Reject Booking Modal */}
            {isRejectModalOpen && currentBookingToReject && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative">
                        <button
                            onClick={handleCloseRejectModal}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold"
                            aria-label="Close reject modal"
                        >
                            &times;
                        </button>
                        <h3 className="text-2xl font-playfair mb-4 text-gray-800">Reject Booking #{currentBookingToReject.id}</h3>
                        <p className="mb-4">Are you sure you want to reject this booking?</p>
                        <div className="mb-4">
                            <label htmlFor="rejectionReason" className="block text-gray-700 text-sm font-bold mb-2">
                                Reason for Rejection:
                            </label>
                            <textarea
                                id="rejectionReason"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-32"
                                value={rejectionMessage}
                                onChange={(e) => setRejectionMessage(e.target.value)}
                                placeholder="e.g., Room no longer available, conflicting booking, etc."
                                required
                            ></textarea>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCloseRejectModal}
                                className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmReject}
                                className="px-5 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition duration-200 ease-in-out"
                                disabled={loading}
                            >
                                {loading ? 'Rejecting...' : 'Confirm Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: Approve Booking Modal */}
            {isApproveModalOpen && currentBookingToApprove && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative">
                        <button
                            onClick={handleCloseApproveModal}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold"
                            aria-label="Close approve modal"
                        >
                            &times;
                        </button>
                        <h3 className="text-2xl font-playfair mb-4 text-gray-800">Approve Booking #{currentBookingToApprove.id}</h3>
                        <p className="mb-4">Assign a physical room for this booking:</p>
                        <div className="mb-4">
                            <label htmlFor="physicalRoomSelect" className="block text-gray-700 text-sm font-bold mb-2">
                                Available Room ({currentBookingToApprove.room.roomType}):
                            </label>
                            <select
                                id="physicalRoomSelect"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={selectedPhysicalRoomId}
                                onChange={(e) => {
                                    const selectedRoom = availablePhysicalRooms.find(room => room.id === parseInt(e.target.value));
                                    setSelectedPhysicalRoomId(e.target.value);
                                    setSelectedAssignedRoomNumber(selectedRoom ? selectedRoom.room_number : '');
                                }}
                                required
                            >
                                <option value="">-- Select a Physical Room --</option>
                                {availablePhysicalRooms.length > 0 ? (
                                    availablePhysicalRooms.map(room => (
                                        <option key={room.id} value={room.id}>
                                            {room.room_number}
                                        </option>
                                    ))
                                ) : (
                                    <option value="" disabled>No available physical rooms for this type.</option>
                                )}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCloseApproveModal}
                                className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmApprove}
                                className="px-5 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition duration-200 ease-in-out"
                                disabled={approvingBooking || !selectedPhysicalRoomId}
                            >
                                {approvingBooking ? 'Approving...' : 'Confirm Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* NEW: Generic Booking Details Modal */}
            {showBookingDetailsModal && selectedBookingDetails && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold">Booking Details for {selectedBookingDetails.user?.firstName || selectedBookingDetails.firstName} {selectedBookingDetails.user?.lastName || selectedBookingDetails.lastName}</h3>
                            <button onClick={handleCloseBookingDetailsModal} className="text-gray-500 hover:text-gray-800">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* General Details */}
                            <div className="border p-4 rounded-lg">
                                <h4 className="font-semibold text-lg mb-2">Booking Information</h4>
                                <p><strong>Status:</strong> {selectedBookingDetails.status}</p>
                                <p><strong>Guests:</strong> {selectedBookingDetails.guests}</p>
                                <p><strong>Check-in:</strong> {formatLocalDateTime(selectedBookingDetails.checkInDate || selectedBookingDetails.checkInDateAndTime)}</p>
                                <p><strong>Check-out:</strong> {formatLocalDateTime(selectedBookingDetails.checkOutDate || selectedBookingDetails.checkOutDateAndTime)}</p>
                                <p><strong>Nights:</strong> {selectedBookingDetails.nights || 'N/A'}</p> {/* Ensure fallback for nights */}
                            </div>

                            {/* User Details */}
                            <div className="border p-4 rounded-lg">
                                <h4 className="font-semibold text-lg mb-2">Guest Information</h4>
                                <p><strong>Name:</strong> {selectedBookingDetails.user?.firstName || selectedBookingDetails.firstName} {selectedBookingDetails.user?.lastName || selectedBookingDetails.lastName}</p>
                                <p><strong>Email:</strong> {selectedUserEmail || 'N/A'}</p>
                                <p><strong>Phone:</strong> {selectedUserDetails?.phone_number || selectedBookingDetails.user?.phone_number || selectedBookingDetails.phone_number || 'N/A'}</p>
                            </div>

                            {/* Room Details */}
                            <div className="border p-4 rounded-lg">
                                <h4 className="font-semibold text-lg mb-2">Room Details</h4>
                                <p><strong>Room Type:</strong> {selectedBookingDetails.room?.roomType || selectedBookingDetails.roomType}</p>
                                <p><strong>Room Number:</strong> {selectedBookingDetails.physicalRoomNumber || 'N/A'}</p>
                                <p><strong>Price per Night:</strong> ₱{parseFloat(selectedBookingDetails.room?.pricePerNight || selectedBookingDetails.roomPrice || 0).toFixed(2)}</p>
                            </div>

                            {/* Payment Details */}
                            <div className="border p-4 rounded-lg">
                                <h4 className="font-semibold text-lg mb-2">Payment Details</h4>
                                <p><strong>Total Price:</strong> ₱{parseFloat(selectedBookingDetails.totalPrice || 0).toFixed(2)}</p>
                                <p><strong>Amount Paid:</strong> ₱{parseFloat(selectedBookingDetails.amountPaid || 0).toFixed(2)}</p> {/* Corrected to amountPaid */}
                                <p><strong>Balance:</strong> ₱{(parseFloat(selectedBookingDetails.totalPrice || 0) - parseFloat(selectedBookingDetails.amountPaid || 0)).toFixed(2)}</p>
                                <p><strong>Payment Status:</strong><span className={`px-2 inline-flex text-m leading-5 font-semibold rounded-full ${
                                    selectedBookingDetails.isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                    {selectedBookingDetails.isPaid ? 'Yes' : 'No'}
                                </span>
                                </p>
                                <p><strong>Late Check-out Fee:</strong> ₱{parseFloat(selectedBookingDetails.lateCheckOutFee || 0).toFixed(2)}</p>
                            </div>

                            {/* Rejection Details (if applicable) */}
                            {selectedBookingDetails.status === 'rejected' && selectedBookingDetails.rejectionReason && (
                                <div className="border p-4 rounded-lg col-span-2 bg-red-50">
                                    <h4 className="font-semibold text-lg text-red-700 mb-2">Rejection Reason</h4>
                                    <p>{selectedBookingDetails.rejectionReason}</p>
                                </div>
                            )}
                            <div class=" pl-135">
                        <button  onClick={handleCloseBookingDetailsModal} class="px-4 py-2 text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700">
                            Close
                        </button>
                        </div>

                        </div>
                    </div>
                </div>
            )}

             {isModalOpen && selectedBooking && (

                        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold">Booking Details for {selectedBooking.firstName} {selectedBooking.lastName}</h3>
                        <button  onClick={handleCloseWalkInModal} class="text-gray-500 hover:text-gray-700">
                            &times;
                        </button>
                        </div>

                        <div class="grid grid-cols-2 gap-4 text-sm text-gray-700">
                        <div className="font-semibold">Booking ID:</div>
                            <div>{selectedBooking.id}</div>
                            <div className="font-semibold">Guest Name:</div>
                            <div>{selectedBooking.firstName} {selectedBooking.lastName}</div>
                            <div className="font-semibold">Room Type:</div>
                            <div>{selectedBooking.roomType}</div>
                            <div className="font-semibold">Room No.:</div>
                            <div>{selectedBooking.physicalRoomNumber || 'N/A'}</div>
                            <div className="font-semibold">Check-in:</div>
                            <div>{formatLocalDateTime(selectedBooking.checkInDateAndTime || selectedBooking.checkInDate)}</div>
                            <div className="font-semibold">Check-out:</div>
                            <div>{formatLocalDateTime(selectedBooking.checkOutDateAndTime || selectedBooking.checkOutDate)}</div>
                            <div className="font-semibold">Guests:</div>
                            <div>{selectedBooking.guests}</div>
                            <div className="font-semibold">Room Price:</div>
                            <div>₱{parseFloat(selectedBooking.roomPrice || 0).toFixed(2)}</div>
                            <div className="font-semibold">Nights:</div>
                            <div>{selectedBooking.nights || 'N/A'}</div> {/* Ensure fallback for nights */}
                            <div className="font-semibold">Total Price:</div>
                            <div>₱{parseFloat(selectedBooking.totalPrice).toFixed(2)}</div>
                            <div className="font-semibold">Paid Status:</div>
                            <div>{selectedBooking.isPaid}</div>
                            <div className="font-semibold">Amount Paid:</div>
                            <div>₱{parseFloat(selectedBooking.amountPaid).toFixed(2)}</div>
                            <div className="font-semibold">Balance:</div>
                            <div>₱{(parseFloat(selectedBooking.totalPrice) - parseFloat(selectedBooking.amountPaid || 0)).toFixed(2)}</div>
                            <div className="font-semibold">Booking Status:</div>
                            <div>{selectedBooking.status}</div>
                            <div className="font-semibold">Discount Type:</div>
                            <div>{selectedBooking.discount_type || 'none'}</div>
                            <div className="font-semibold">Discount Amount:</div>
                            <div>₱{selectedBooking.discount_amount || '0.00'}</div>
                            <div className="font-semibold">Late Check-out Fee:</div>
                            <div>₱{parseFloat(selectedBooking.lateCheckOutFee || 0).toFixed(2)}</div>
                            <div className="font-semibold">Early Check-in Fee:</div>
                            <div>₱{parseFloat(selectedBooking.earlyCheckInFee || 0).toFixed(2)}</div>
                        </div>

                        <div class="mt-6 flex justify-end">
                        <button  onClick={handleCloseWalkInModal} class="px-4 py-2 text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700">
                            Close
                        </button>
                        </div>
                    </div>
                    </div>
)}
        </div>
    );
};

export default AdminDashboard;
