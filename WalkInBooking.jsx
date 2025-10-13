import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth, useUser } from '@clerk/clerk-react';
import { DayPicker } from 'react-day-picker'; // Keep import for now, but will remove DayPicker component usage
import 'react-day-picker/dist/style.css';
import '../../styles/calendar.css';
import { format, addDays, differenceInDays, isSameDay, eachDayOfInterval } from 'date-fns';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const WalkInBooking = () => {
    // State for guest information
    const [guestInfo, setGuestInfo] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
    });

    // State for date selection
    const [selectedCheckInDate, setSelectedCheckInDate] = useState(new Date()); // Default to current date
    const [numberOfNightsInput, setNumberOfNightsInput] = useState(1); // New state for number of nights
    const [selectedCheckOutDate, setSelectedCheckOutDate] = useState(addDays(new Date(), 1)); // Calculated based on check-in + nights
    const [actualCheckInTimeInput, setActualCheckInTimeInput] = useState('');
    const [guests, setGuests] = useState(1);

    // State for room selection
    const [roomTypes, setRoomTypes] = useState([]);
    const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('');
    const [physicalRooms, setPhysicalRooms] = useState([]);
    const [availablePhysicalRooms, setAvailablePhysicalRooms] = useState([]);
    const [selectedPhysicalRoomId, setSelectedPhysicalRoomId] = useState('');
    const [amountPaid, setAmountPaid] = useState(0); // Initialize with 0

    // State for booking calculations and display
    const [earlyCheckInFee, setEarlyCheckInFee] = useState(0);
    const [calculatedTotalPrice, setCalculatedTotalPrice] = useState(0);
    const [selectedRoomTypeDetails, setSelectedRoomTypeDetails] = useState(null);
    const [discountType, setDiscountType] = useState('none'); // New state for discount type

    // UI states
    const [loading, setLoading] = useState(true);
    const [bookingProcessing, setBookingProcessing] = useState(false);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [bookedDatesForSelectedPhysicalRoom, setBookedDatesForSelectedPhysicalRoom] = useState([]);
    // New state for valid ID file
    const [validIdFile, setValidIdFile] = useState(null);

    // Clerk authentication
    const { getToken } = useAuth();
    const { user, isSignedIn } = useUser();

    const clearWalkInForm = useCallback(() => {
        setGuestInfo({ firstName: '', lastName: '', email: '', phone: '' });
        const now = new Date();
        setSelectedCheckInDate(now);
        setNumberOfNightsInput(1);
        setSelectedCheckOutDate(addDays(now, 1));
        setActualCheckInTimeInput(format(now, 'HH:mm'));
        setGuests(1);
        setSelectedRoomTypeId('');
        setSelectedPhysicalRoomId('');
        setAvailablePhysicalRooms([]);
        setBookedDatesForSelectedPhysicalRoom([]);
        setEarlyCheckInFee(0);
        setCalculatedTotalPrice(0);
        setValidIdFile(null); // Clear the file selection
        setDiscountType('none'); // Clear discount type
    }, []);

    const handleCheckPhysicalRoomAvailability = useCallback(async () => {
        setCheckingAvailability(true);
        setAvailablePhysicalRooms([]);
        setSelectedPhysicalRoomId('');
        setNotification({ message: '', type: '' });

        // Ensure check-out date is calculated before validation
        const calculatedCheckOutDate = addDays(selectedCheckInDate, numberOfNightsInput);

        if (!selectedRoomTypeId || !selectedCheckInDate || !calculatedCheckOutDate || guests < 1) {
            setNotification({ message: 'Please select room type, dates, and number of guests.', type: 'error' });
            setCheckingAvailability(false);
            return;
        }

        const checkIn = format(selectedCheckInDate, 'yyyy-MM-dd');
        const checkOut = format(calculatedCheckOutDate, 'yyyy-MM-dd'); // Use calculated check-out

        if (new Date(checkOut) <= new Date(checkIn)) {
            setNotification({ message: 'Check-out date must be after check-in date.', type: 'error' });
            setCheckingAvailability(false);
            return;
        }

        const roomTypeMaxGuests = roomTypes.find(rt => rt.id === selectedRoomTypeId)?.maxGuests;
        if (guests > roomTypeMaxGuests) {
            setNotification({ message: `This room type can only accommodate a maximum of ${roomTypeMaxGuests} guests.`, type: 'error' });
            setCheckingAvailability(false);
            return;
        }

        try {
            const token = await getToken();
            if (!token) {
                setNotification({ message: 'Authentication token missing. Please log in.', type: 'error' });
                setCheckingAvailability(false);
                return;
            }

            const roomsOfTypeAndAvailable = physicalRooms.filter(pr =>
                pr.roomTypeId === selectedRoomTypeId && pr.status === 'available'
            );

            const availableRooms = [];
            for (const room of roomsOfTypeAndAvailable) {
                const bookingsRes = await axios.get(`${BACKEND_URL}/bookings/physical-room/${room.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const roomBookings = bookingsRes.data;

                const requestedStayDays = eachDayOfInterval({
                    start: selectedCheckInDate,
                    end: addDays(calculatedCheckOutDate, -1) // Use calculated check-out
                });

                const hasOverlap = roomBookings.some(booking => {
                    const existingCheckIn = new Date(booking.checkInDate);
                    const existingCheckOut = new Date(booking.checkOutDate);
                    const existingBookedDays = eachDayOfInterval({
                        start: existingCheckIn,
                        end: addDays(existingCheckOut, -1)
                    });

                    return requestedStayDays.some(reqDay =>
                        existingBookedDays.some(bookedDay => isSameDay(reqDay, bookedDay))
                    );
                });

                if (!hasOverlap) {
                    availableRooms.push(room);
                }
            }

            if (availableRooms.length > 0) {
                setAvailablePhysicalRooms(availableRooms);
                setNotification({ message: 'Available physical rooms found!', type: 'success' });
            } else {
                setNotification({ message: 'No physical rooms available for the selected criteria and dates.', type: 'error' });
            }

        } catch (error) {
            console.error('Error checking physical room availability:', error);
            setNotification({ message: `Error checking availability: ${error.response?.data?.error || error.message}`, type: 'error' });
        } finally {
            setCheckingAvailability(false);
        }
    }, [
        getToken,
        setNotification,
        roomTypes,
        physicalRooms,
        selectedRoomTypeId,
        selectedCheckInDate,
        numberOfNightsInput,
        guests,
        setAvailablePhysicalRooms,
        setSelectedPhysicalRoomId,
        setCheckingAvailability
    ]);

    useEffect(() => {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        setActualCheckInTimeInput(`${hours}:${minutes}`);
        // Set initial check-out date based on default check-in and nights
        setSelectedCheckOutDate(addDays(now, numberOfNightsInput));
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const token = await getToken();
                if (!token) {
                    setNotification({ message: 'Authentication token missing. Please log in.', type: 'error' });
                    setLoading(false);
                    return;
                }
                const roomTypesRes = await axios.get(`${BACKEND_URL}/rooms`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const fetchedRoomTypes = roomTypesRes.data.map(room => ({
                    ...room,
                    maxGuests: Number(room.maxGuests) || 1,
                    isAvailable: Boolean(room.isAvailable),
                    pricePerNight: Number(room.pricePerNight) || 0,
                }));
                setRoomTypes(fetchedRoomTypes);

                const physicalRoomsRes = await axios.get(`${BACKEND_URL}/physical-rooms`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const normalizedPhysicalRooms = physicalRoomsRes.data.map(pr => ({
                    ...pr,
                    id: Number(pr.id),
                    roomTypeId: Number(pr.room_type_id)
                }));
                setPhysicalRooms(normalizedPhysicalRooms);
            } catch (error) {
                console.error('Failed to fetch initial data:', error);
                setNotification({ message: `Failed to load data: ${error.response?.data?.error || error.message}`, type: 'error' });
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [getToken]);

    useEffect(() => {
        const details = roomTypes.find(rt => rt.id === selectedRoomTypeId);
        setSelectedRoomTypeDetails(details || null);
        if (details) {
            setGuests(prevGuests => Math.min(prevGuests, details.maxGuests));
        } else {
            setGuests(1);
        }
    }, [selectedRoomTypeId, roomTypes]);

    // Effect to update selectedCheckOutDate when selectedCheckInDate or numberOfNightsInput changes
    useEffect(() => {
        if (selectedCheckInDate && numberOfNightsInput > 0) {
            setSelectedCheckOutDate(addDays(selectedCheckInDate, numberOfNightsInput));
        } else {
            setSelectedCheckOutDate(undefined);
        }
    }, [selectedCheckInDate, numberOfNightsInput]);


    const calculateBookingPrice = useCallback(() => {
        if (!selectedRoomTypeDetails || !selectedCheckInDate || !selectedCheckOutDate) {
            setEarlyCheckInFee(0);
            setCalculatedTotalPrice(0);
            return;
        }
        const checkInDateObj = new Date(selectedCheckInDate);
        checkInDateObj.setHours(0, 0, 0, 0);
        const checkOutDateObj = new Date(selectedCheckOutDate);
        checkOutDateObj.setHours(0, 0, 0, 0);

        if (checkOutDateObj <= checkInDateObj) {
            setEarlyCheckInFee(0);
            setCalculatedTotalPrice(0);
            return;
        }
        const calculatedNights = differenceInDays(checkOutDateObj, checkInDateObj);
        let basePrice = calculatedNights * selectedRoomTypeDetails.pricePerNight;
        let currentEarlyFee = 0;
        if (actualCheckInTimeInput) {
            const desiredCheckInDateTime = new Date(`${format(selectedCheckInDate, 'yyyy-MM-dd')}T${actualCheckInTimeInput}:00`);
            const standardCheckInDateTime = new Date(`${format(selectedCheckInDate, 'yyyy-MM-dd')}T14:00:00`);
            if (desiredCheckInDateTime < standardCheckInDateTime) {
                const diffMillis = standardCheckInDateTime.getTime() - desiredCheckInDateTime.getTime();
                const earlyHours = Math.ceil(diffMillis / (1000 * 60 * 60));
                currentEarlyFee = earlyHours * 100;
            }
        }
        let finalCalculatedTotal = basePrice + currentEarlyFee;

        // Apply discount based on discountType
        if (discountType === 'senior' || discountType === 'repeater') {
            finalCalculatedTotal *= 0.90; // 10% discount
        }

        setEarlyCheckInFee(currentEarlyFee);
        setCalculatedTotalPrice(finalCalculatedTotal);
    }, [selectedRoomTypeDetails, selectedCheckInDate, selectedCheckOutDate, actualCheckInTimeInput, discountType]); // Add discountType to dependencies

    useEffect(() => {
        calculateBookingPrice();
    }, [calculateBookingPrice]);

    useEffect(() => {
        const debounceCheck = setTimeout(() => {
            // Only check availability if selectedCheckOutDate is defined (i.e., numberOfNightsInput > 0)
            if (selectedCheckOutDate) {
                handleCheckPhysicalRoomAvailability();
            }
        }, 300); // Increased debounce time for better user experience
        return () => clearTimeout(debounceCheck);
    }, [selectedRoomTypeId, selectedCheckInDate, numberOfNightsInput, guests, physicalRooms, handleCheckPhysicalRoomAvailability, selectedCheckOutDate]);


    useEffect(() => {
        const fetchBookedDatesForSelectedPhysicalRoom = async () => {
            if (selectedPhysicalRoomId) {
                try {
                    const token = await getToken();
                    const bookingsRes = await axios.get(`${BACKEND_URL}/bookings/physical-room/${selectedPhysicalRoomId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const roomBookings = bookingsRes.data;
                    const allBookedDays = new Set();
                    roomBookings.forEach(booking => {
                        const checkIn = new Date(booking.checkInDate);
                        const checkOut = new Date(booking.checkOutDate);
                        const daysInInterval = eachDayOfInterval({
                            start: checkIn,
                            end: addDays(checkOut, -1)
                        });
                        daysInInterval.forEach(day => allBookedDays.add(day.toDateString()));
                    });
                    setBookedDatesForSelectedPhysicalRoom(Array.from(allBookedDays).map(dateStr => new Date(dateStr)));
                } catch (error) {
                    console.error('Failed to fetch booked dates for physical room:', error);
                    setNotification({ message: 'Failed to load booked dates for selected room.', type: 'error' });
                }
            } else {
                setBookedDatesForSelectedPhysicalRoom([]);
            }
        };
        fetchBookedDatesForSelectedPhysicalRoom();
    }, [selectedPhysicalRoomId, getToken]);

    const handleGuestInfoChange = (e) => {
        const { name, value } = e.target;
        if (name === 'guests') {
            const newGuests = Math.max(1, parseInt(value) || 1);
            const maxAllowedGuests = selectedRoomTypeDetails?.maxGuests || 1;
            setGuests(Math.min(newGuests, maxAllowedGuests));
        } else {
            setGuestInfo(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleNumberOfNightsChange = (e) => {
        const value = parseInt(e.target.value);
        if (value >= 1) { // Ensure at least 1 night
            setNumberOfNightsInput(value);
            setNotification({ message: '', type: '' }); // Clear any previous date error
        } else if (e.target.value === '') {
            setNumberOfNightsInput(''); // Allow temporary empty input for user to type
        }
    };


    const handleIdFileChange = (e) => {
        setValidIdFile(e.target.files[0]);
    };

    const handleBookNow = async () => {
        setBookingProcessing(true);
        setNotification({ message: '', type: '' });

        if (!isSignedIn || !user || !user.id) {
            setNotification({ message: 'Authentication required. Please log in as an administrator.', type: 'error' });
            setBookingProcessing(false);
            return;
        }
        if (!selectedRoomTypeId || !selectedPhysicalRoomId || !selectedCheckInDate || !selectedCheckOutDate || !guestInfo.firstName || !guestInfo.lastName || !guestInfo.email || !guestInfo.phone) {
            setNotification({ message: 'Please fill all required fields, select room type, physical room, and dates.', type: 'error' });
            setBookingProcessing(false);
            return;
        }
        if (calculatedTotalPrice <= 0) {
            setNotification({ message: 'Booking price must be greater than zero. Please select valid dates.', type: 'error' });
            setBookingProcessing(false);
            return;
        }
        // Validate if a valid ID file is selected
        if (!validIdFile) {
            setNotification({ message: 'Please upload a valid ID.', type: 'error' });
            setBookingProcessing(false);
            return;
        }
        if (amountPaid < 0) {
        setNotification({ message: 'Amount Paid cannot be negative.', type: 'error' });
        setBookingProcessing(false);
        return;
        }


        const checkIn = format(selectedCheckInDate, 'yyyy-MM-dd');
        const checkOut = format(selectedCheckOutDate, 'yyyy-MM-dd');
        // Always set check-in time to the current time at booking
        const nowAtBooking = new Date();
        const currentTimeString = format(nowAtBooking, 'HH:mm');
        const actualCheckInDateTimeString = `${checkIn}T${currentTimeString}:00`;

        try {
            const token = await getToken();
            if (!token) {
                setNotification({ message: 'Authentication token missing. Please log in.', type: 'error' });
                setBookingProcessing(false);
                return;
            }

            // Create FormData object to send both text data and the file
            const formData = new FormData();
            formData.append('userId', user.id);
            formData.append('roomTypeId', selectedRoomTypeId);
            formData.append('physicalRoomId', selectedPhysicalRoomId);
            formData.append('checkInDate', checkIn);
            formData.append('checkOutDate', checkOut);
            formData.append('earlyCheckInFee', earlyCheckInFee);
            formData.append('totalPrice', calculatedTotalPrice);
            formData.append('guests', guests);
            formData.append('isPaid', true); // Assuming walk-ins are paid immediately
            if (actualCheckInDateTimeString) {
                formData.append('actualCheckInTime', actualCheckInDateTimeString);
            }
            formData.append('firstName', guestInfo.firstName);
            formData.append('lastName', guestInfo.lastName);
            formData.append('email', guestInfo.email);
            formData.append('phone', guestInfo.phone);
            formData.append('validId', validIdFile); // Append the actual file
            formData.append('amountPaid', amountPaid);
            formData.append('discountType', discountType); // Add discountType to formData
            formData.append('discountAmount', discountAmount.toFixed(2));

            console.log("Sending bookingPayload (FormData):", Object.fromEntries(formData.entries())); // For debugging FormData

            const response = await axios.post(`${BACKEND_URL}/bookings/walk-in`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const bookingDataFromServer = response.data;
            console.log("Received bookingDataFromServer:", bookingDataFromServer);


            setNotification({ message: `Walk-in booking successful! Booking ID: ${bookingDataFromServer.bookingId || bookingDataFromServer.id}`, type: 'success' });

            // Add a delay before clearing the form
            setTimeout(() => {
                clearWalkInForm();
            }, 10000);

        } catch (error) {
            console.error('Failed to create walk-in booking:', error);
            setNotification({ message: `Failed to create booking: ${error.response?.data?.error || error.message}`, type: 'error' });
        } finally {
            setBookingProcessing(false);
        }
    };

    const roomPriceForStay = (selectedRoomTypeDetails?.pricePerNight || 0) * numberOfNightsInput;

    const discountAmount = (discountType === 'senior' || discountType === 'repeater') ? (roomPriceForStay + earlyCheckInFee) * 0.10 : 0;
    const finalDisplayPrice = calculatedTotalPrice;

    if (loading) return <p className="text-center py-20 text-gray-700">Loading walk-in booking page...</p>;

    return (
        <div className="pt-6 md:pt-8 px-4 md:px-8 lg:px-12 xl:px-16 pb-12 bg-gray-100 min-h-screen">
            <h1 className='text-3xl md:text-4xl font-playfair mb-6 text-gray-800 text-center'>Walk-in Booking</h1>
            <p className='text-sm text-gray-600 mb-8 text-center'>Process direct bookings for walk-in guests.</p>

            {notification.message && (
                <div
                    className={`mb-4 p-3 rounded-md text-sm font-medium ${
                        notification.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                    } shadow-sm max-w-2xl mx-auto`}
                >
                    {notification.message}
                </div>
            )}

            {/* Main Booking Form Area */}

                 <div className="grid grid-cols-1 max-w-3xl mx-auto">
                    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                        <h2 className="text-2xl font-playfair mb-6 text-gray-800 border-b pb-3">New Walk-in Booking</h2>

                        {/* Guest Information */}
                        <div className="mb-6 border-b pb-4 border-gray-200">
                            <h3 className="text-xl font-semibold mb-4 text-gray-700 flex items-center">
                                <i className="fas fa-user-circle mr-2 text-blue-500"></i> Guest Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                    <input
                                        type="text" id="firstName" name="firstName" value={guestInfo.firstName} onChange={handleGuestInfoChange}
                                        className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 ease-in-out" required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                    <input
                                        type="text" id="lastName" name="lastName" value={guestInfo.lastName} onChange={handleGuestInfoChange}
                                        className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 ease-in-out" required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email" id="email" name="email" value={guestInfo.email} onChange={handleGuestInfoChange}
                                        className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 ease-in-out" required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                    <input
                                        type="tel" id="phone" name="phone" value={guestInfo.phone} onChange={handleGuestInfoChange}
                                        className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 ease-in-out" required
                                    />
                                </div>
                                {/* New: Valid ID Upload Field */}
                                <div>
                                    <label htmlFor="validId" className="block text-sm font-medium text-gray-700 mb-1">Upload Valid ID (Image or PDF)</label>
                                    <input
                                        type="file" id="validId" name="validId" onChange={handleIdFileChange}
                                        className="w-full text-gray-700 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                        accept="image/*,.pdf" // Allow images and PDFs
                                        required
                                    />
                                    {validIdFile && <p className="text-xs text-gray-500 mt-1">Selected file: {validIdFile.name}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Room and Date Selection */}
                        <div className="mb-6 border-b pb-4 border-gray-200">
                            <h3 className="text-xl font-semibold mb-4 text-gray-700 flex items-center">
                                <i className="fas fa-bed mr-2 text-blue-500"></i> Room & Dates
                            </h3>
                            <div className="mb-4">
                                <label htmlFor="roomTypeSelect" className="block text-sm font-medium text-gray-700 mb-1">Select Room Type:</label>
                               <select
                                    id="roomTypeSelect" value={selectedRoomTypeId}
                                   onChange={(e) => {
                                    const value = Number(e.target.value);
                                    setSelectedRoomTypeId(value);
                                    setSelectedPhysicalRoomId('');
                                    setAvailablePhysicalRooms([]);
                                    setBookedDatesForSelectedPhysicalRoom([]);
                                    }}
                                    className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 ease-in-out"
                                >
                                    <option value="">Choose Room Type</option>
                                    {roomTypes.filter(rt => rt.isAvailable).map(roomType => (
                                        <option key={roomType.id} value={roomType.id}>
                                            {roomType.roomType} (Max Guests: {roomType.maxGuests}, ₱{roomType.pricePerNight} / night)
                                        </option>
                                    ))}
                                    </select>
                            </div>
                            <div className="mb-4">
                                <label htmlFor="guests" className="block text-sm font-medium text-gray-700 mb-1">Number of Guests:</label>
                                <input
                                    type="number" id="guests" name="guests" value={guests} onChange={handleGuestInfoChange}
                                    min="1" max={selectedRoomTypeDetails?.maxGuests || 1}
                                    className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 ease-in-out"
                                />
                                {selectedRoomTypeDetails && <p className="text-xs text-gray-500 mt-1">Max capacity for {selectedRoomTypeDetails.roomType}: {selectedRoomTypeDetails.maxGuests} guests</p>}
                            </div>
                            <div className="mb-4">
                                <p className="block text-sm font-medium text-gray-700 mb-1">Check-in Date:</p>
                                <input
                                    type="text"
                                    value={selectedCheckInDate ? format(selectedCheckInDate, 'MMM dd,yyyy') : ''}
                                    className="w-full border border-gray-300 p-2 rounded-md bg-gray-100 cursor-not-allowed"
                                    readOnly
                                />
                                <p className="text-xs text-gray-500 mt-1">Check-in date is set to the current date.</p>
                            </div>

                            <div className="mb-4">
                                <label htmlFor="numberOfNights" className="block text-sm font-medium text-gray-700 mb-1">Number of Nights:</label>
                                <input
                                    type="number"
                                    id="numberOfNights"
                                    name="numberOfNights"
                                    value={numberOfNightsInput}
                                    onChange={handleNumberOfNightsChange}
                                    min="1"
                                    className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 ease-in-out"
                                />
                            </div>

                            <div className="mb-4">
                                <p className="block text-sm font-medium text-gray-700 mb-1">Calculated Check-out Date:</p>
                                <input
                                    type="text"
                                    value={selectedCheckOutDate ? format(selectedCheckOutDate, 'MMM dd,yyyy') : 'N/A'}
                                    className="w-full border border-gray-300 p-2 rounded-md bg-gray-100 cursor-not-allowed"
                                    readOnly
                                />
                            </div>

                            {/* Removed the DayPicker component entirely */}
                            {/*
                            <div className="mb-4">
                                <p className="block text-sm font-medium text-gray-700 mb-1">Visual Date Range (for reference):</p>
                                <DayPicker
                                    mode="range" selected={modifiers.selected}
                                    modifiers={modifiers}
                                    modifiersStyles={{ selected: { backgroundColor: 'rgb(96, 165, 250)', color: 'white' }, booked: { backgroundColor: '#fca5a5', textDecoration: 'line-through', color: '#ef4444' }}}
                                    disabled={disabledDays} footer={footer} className="booking-calendar border border-gray-200 rounded-md p-3 shadow-sm"
                                />
                            </div>
                            */}

                            <div className="mb-4">
                                <label htmlFor="actualCheckInTime" className="block text-sm font-medium text-gray-700 mb-1">Check-in Time</label>
                            <input
                                type="time"
                                id="actualCheckInTime"
                                value={actualCheckInTimeInput}
                                onChange={(e) => setActualCheckInTimeInput(e.target.value)}
                                className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 ease-in-out bg-gray-100"
                                readOnly
                            />
                            <p className="text-xs text-gray-500 mt-1">Automatically set to the current time when you click Book Now.</p>
                           
                            </div>
                            {selectedRoomTypeId && selectedCheckInDate && selectedCheckOutDate && (
                                <div className="mb-4">
                                    <label htmlFor="physicalRoomSelect" className="block text-sm font-medium text-gray-700 mb-1">Select Physical Room:</label>
                                   <select
                                        id="physicalRoomSelect" value={selectedPhysicalRoomId} onChange={(e) => setSelectedPhysicalRoomId(Number(e.target.value))}
                                        className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 ease-in-out"
                                        disabled={availablePhysicalRooms.length === 0 || checkingAvailability}
                                    >
                                        <option value="">{checkingAvailability ? 'Checking rooms...' : 'Choose Physical Room'}</option>
                                        {availablePhysicalRooms.map(room => (
                                            <option key={room.id} value={room.id}>{room.room_number} ({room.status.charAt(0).toUpperCase() + room.status.slice(1)})</option>
                                        ))}
                                    </select>
                                    {checkingAvailability && <p className="text-sm text-blue-500 mt-1 flex items-center"><i className="fas fa-spinner fa-spin mr-2"></i>Checking available physical rooms...</p>}
                                    {availablePhysicalRooms.length === 0 && !checkingAvailability && selectedRoomTypeId && selectedCheckInDate && selectedCheckOutDate && (
                                        <p className="text-sm text-red-500 mt-1 flex items-center"><i className="fas fa-exclamation-triangle mr-2"></i>No physical rooms available for selected criteria and dates.</p>
                                    )}
                                </div>
                            )}

                           <div className="mb-6 border-b pb-4 border-gray-200">
                            <h3 className="text-xl font-semibold mb-4 text-gray-700 flex items-center">
                                <i className="fas fa-money-bill-wave mr-2 text-green-500"></i> Payment Details
                            </h3>
                            {/* New: Discount Type Selection */}
                            <div className="mt-4">
                                <label htmlFor="discountType" className="block text-sm font-medium text-gray-700 mb-1">
                                    Apply Discount:
                                </label>
                                <select
                                    id="discountType"
                                    name="discountType"
                                    value={discountType}
                                    onChange={(e) => setDiscountType(e.target.value)}
                                    className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150 ease-in-out"
                                >
                                    <option value="none">No Discount</option>
                                    <option value="senior">Senior (10%)</option>
                                    <option value="repeater">Repeater Guest (10%)</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700 mb-1">
                                Amount Paid (₱)
                                </label>
                                <input
                                type="number"
                                id="amountPaid"
                                name="amountPaid"
                                value={amountPaid === 0 ? '' : amountPaid}
                                onChange={(e) => {
                                    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    setAmountPaid(value || 0);
                                }}
                                className="w-full border border-gray-300 p-2 rounded-md focus:ring-green-500 focus:border-green-500 outline-none transition duration-150 ease-in-out"
                                placeholder="0"
                                min="0"
                                step="0.01"
                                required
                                />
                            </div>
                            
                            </div>

                        </div>

                        {/* Booking Summary */}
                        <div className="mb-6 p-6 border border-gray-200 rounded-xl bg-gradient-to-r from-blue-50 to-white shadow-md">
                            <h3 className="text-lg font-bold text-gray-800 mb-3 border-b pb-2 flex items-center">
                                <i className="fas fa-receipt mr-2 text-purple-600"></i> Booking Summary
                            </h3>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-gray-700"><span>Room Type:</span><span className="font-semibold text-gray-900">{selectedRoomTypeDetails?.roomType || 'N/A'}</span></div>
                                <div className="flex justify-between items-center text-gray-700"><span>Physical Room:</span><span className="font-semibold text-gray-900">{physicalRooms.find(pr => pr.id === Number(selectedPhysicalRoomId))?.room_number || 'N/A'}</span></div>
                                <div className="flex justify-between items-center text-gray-700"><span>Check-in:</span><span className="font-semibold text-gray-900">{selectedCheckInDate ? format(selectedCheckInDate, 'MMM dd,yyyy') : 'N/A'}</span></div>
                                <div className="flex justify-between items-center text-gray-700"><span>Check-out:</span><span className="font-semibold text-gray-900">{selectedCheckOutDate ? format(selectedCheckOutDate, 'MMM dd,yyyy') : 'N/A'}</span></div>
                                <div className="flex justify-between items-center text-gray-700"><span>Nights:</span><span className="font-semibold text-gray-900">{numberOfNightsInput}</span></div>
                                <div className="flex justify-between items-center text-gray-700"><span>Base Price ({numberOfNightsInput} nights):</span><span className="font-semibold text-gray-900">₱{roomPriceForStay.toFixed(2)}</span></div>
                                <div className="flex justify-between items-center text-gray-700"><span>Early Check-in Fee:</span><span className="font-semibold text-red-600">₱{earlyCheckInFee.toFixed(2)}</span></div>
                                {/* Display Discount */}
                                <div className="flex justify-between items-center text-gray-700"><span>Discount ({discountType === 'none' ? 'None' : '10%'}):</span><span className="font-semibold text-green-600">- ₱{discountAmount.toFixed(2)}</span></div>
                            </div>
                            <div className="border-t border-gray-300 mt-4 pt-3 flex justify-between items-center">
                                <span className="text-xl font-bold text-gray-800">₱Total Price:</span>
                                <span className="text-3xl font-extrabold text-blue-700">₱{finalDisplayPrice.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleBookNow}
                            className={`w-full py-3 rounded-xl text-white font-semibold text-lg transition-all duration-300 ease-in-out transform hover:scale-105 shadow-lg
                                ${(selectedPhysicalRoomId && calculatedTotalPrice > 0 && !bookingProcessing && !checkingAvailability && validIdFile && numberOfNightsInput >= 1)
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-gray-400 cursor-not-allowed opacity-70'
                                }`}
                            disabled={!selectedPhysicalRoomId || calculatedTotalPrice <= 0 || bookingProcessing || checkingAvailability || !validIdFile || numberOfNightsInput < 1}
                        >
                            {bookingProcessing ? (<><i className="fas fa-spinner fa-spin mr-2"></i> Processing Booking...</>) : (<><i className="fas fa-check-circle mr-2"></i> Book Now</>)}
                        </button>
                    </div>
                </div>
                {notification.message && (
                <div
                    className={`mb-4 p-3 rounded-md text-sm font-medium ${
                        notification.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'text-transparent'
                    }  max-w-2xl mx-auto`}
                >
                    {notification.message}
                </div>
            )}
        </div>
    );
};

export default WalkInBooking;