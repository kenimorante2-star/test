import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { assets, facilityIcons } from '../assets/assets';
import { useNavigate } from 'react-router-dom';
import StarRating from '../components/StarRating';

// --- Helper Components (No Changes Needed) ---
const Checkbox = ({ label, selected = false, onChange = () => {} }) => {
    return (
        <label className="flex gap-3 items-center cursor-pointer mt-2 text-sm">
            <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onChange(label, e.target.checked)}
                className="form-checkbox h-4 w-4 text-primary rounded"
            />
            <span className="font-light select-none">{label}</span>
        </label>
    );
};

const RadioButton = ({ label, selected = false, onChange = () => {} }) => {
    return (
        <label className="flex gap-3 items-center cursor-pointer mt-2 text-sm">
            <input
                type="radio"
                name="sortOption"
                checked={selected}
                onChange={() => onChange(label)}
                className="form-radio h-4 w-4 text-primary"
            />
            <span className="font-light select-none">{label}</span>
        </label>
    );
};
// ---------------------------------------------

// --- CONSTANT DATA MOVED OUTSIDE COMPONENT (only non-dynamic ones) ---
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_BASE_URL) {
    console.warn("WARNING: REACT_APP_BACKEND_URL is not set. Frontend API calls will likely fail.");
}

const SORT_OPTIONS = ['Price Low to High', 'Price High to Low', 'Newest First'];
// ---------------------------------------------


const AllRooms = () => {
    const navigate = useNavigate();
    const [allRooms, setAllRooms] = useState([]); // Stores all fetched available rooms
    const [displayedRooms, setDisplayedRooms] = useState([]); // Stores filtered/sorted rooms for display
    const [loading, setLoading] = useState(true); // <--- FIXED THIS LINE!
    const [error, setError] = useState(null);
    const [openFilters, setOpenFilters] = useState(false);

    // --- State for Dynamic Filter Options ---
    const [availableRoomTypes, setAvailableRoomTypes] = useState([]);
    const [availablePriceRanges, setAvailablePriceRanges] = useState([]);
    const [availableAmenities, setAvailableAmenities] = useState([]);

    // --- State for Selected Filters and Sort ---
    const [selectedRoomTypes, setSelectedRoomTypes] = useState([]);
    const [selectedPriceRange, setSelectedPriceRange] = useState('');
    const [selectedAmenities, setSelectedAmenities] = useState([]);
    const [currentSortOption, setCurrentSortOption] = useState('Newest First');

    // --- Handlers for Filter Changes ---
    const handleRoomTypeChange = (type, isChecked) => {
        setSelectedRoomTypes(prev =>
            isChecked ? [...prev, type] : prev.filter(t => t !== type)
        );
    };

    const handlePriceRangeChange = (rangeLabel, isChecked) => {
        setSelectedPriceRange(isChecked ? rangeLabel : '');
    };

    const handleAmenityChange = (amenity, isChecked) => {
        setSelectedAmenities(prev =>
            isChecked ? [...prev, amenity] : prev.filter(a => a !== amenity)
        );
    };

    const handleSortChange = (option) => {
        setCurrentSortOption(option);
    };

    const handleClearFilters = () => {
        setSelectedRoomTypes([]);
        setSelectedPriceRange('');
        setSelectedAmenities([]);
        setCurrentSortOption('Newest First');
        setOpenFilters(false);
    };

    // --- Initial Fetch of Rooms and Dynamic Filter Options Generation ---
   
useEffect(() => {
    const fetchAndPrepareRooms = async () => {
        try {
            const roomsUrl = `${BACKEND_BASE_URL}/rooms`;
            const ratingsUrl = `${BACKEND_BASE_URL}/room-ratings-summary`;

            // 🛑 TEMPORARY LOGGING ADDED HERE
            console.log("------------------------------------------------------------------");
            console.log(`[API CHECK] Attempting to fetch rooms from URL: ${roomsUrl}`);
            console.log(`[API CHECK] Attempting to fetch ratings from URL: ${ratingsUrl}`);
            console.log("------------------------------------------------------------------");
            // 🛑 END TEMPORARY LOGGING

            // Fetch rooms and ratings concurrently for better performance
            const [roomsResponse, ratingsResponse] = await Promise.all([
                // NOTE: Ensure your backend has the /rooms endpoint configured correctly
                axios.get(`${BACKEND_BASE_URL}/rooms`), 
                axios.get(`${BACKEND_BASE_URL}/room-ratings-summary`) 
            ]);
            

            // 🛑 CRITICAL FIX 1: Validate roomsResponse.data is an array
            const fetchedRooms = roomsResponse.data;
            if (!Array.isArray(fetchedRooms)) {
                console.error("Rooms API returned data that is not an array:", fetchedRooms);
                // Set state to an empty array to prevent filtering crash
                setAllRooms([]); 
                setLoading(false);
                setError('Rooms data format error. Check backend response for /rooms.');
                return; // Exit the function early
            }

            const fetchedRatingsSummary = ratingsResponse.data;
            
            // 🛑 CRITICAL FIX 2: Validate ratingsResponse.data is an object (or fall back to an empty object)
            // The ratings summary is expected to be an object (map), so we check if it's null/undefined
            const ratingsMap = (typeof fetchedRatingsSummary === 'object' && fetchedRatingsSummary !== null) 
                               ? fetchedRatingsSummary 
                               : {};
            
            // Filter available rooms and enrich them with rating data
            const fetchedAvailableRooms = fetchedRooms
                .filter(room => room.isAvailable === 1) // This line now safe due to Fix 1
                .map(room => {
                    // Use the safe ratingsMap
                    const roomRatingInfo = ratingsMap[room.id] || { averageRating: 0, reviewCount: 0 };
                    return {
                        ...room,
                        averageRating: parseFloat(roomRatingInfo.averageRating || 0), // Use || 0 as fallback
                        reviewCount: parseInt(roomRatingInfo.reviewCount || 0, 10)     
                    };
                });

            setAllRooms(fetchedAvailableRooms);
            setLoading(false);

            // --- Generate Dynamic Filter Options (Remains unchanged) ---
            const uniqueRoomTypes = new Set();
            const uniqueAmenities = new Set();
            let maxPriceFromRooms = 0;

            fetchedAvailableRooms.forEach(room => {
                uniqueRoomTypes.add(room.roomType);
                if (room.amenities && Array.isArray(room.amenities)) {
                    room.amenities.forEach(amenity => uniqueAmenities.add(amenity));
                }
                if (room.pricePerNight !== undefined && room.pricePerNight !== null) {
                    maxPriceFromRooms = Math.max(maxPriceFromRooms, room.pricePerNight);
                }
            });

            setAvailableRoomTypes(Array.from(uniqueRoomTypes).sort());
            setAvailableAmenities(Array.from(uniqueAmenities).sort());

            // Dynamically generate price ranges logic...
            const generatedPriceRanges = [];
            const priceStep = 1000;
            const fixedMinPrice = 2000;

            let currentMin = fixedMinPrice;
            let currentMax = fixedMinPrice + priceStep; // The "to" value for the label

            while (currentMin <= maxPriceFromRooms + priceStep) {
                let label;
                let rangeMax; // This will be the exclusive upper bound for filtering

                // If the current minimum is the highest, or covers the max price, make it an 'X+' range
                if (currentMin >= maxPriceFromRooms && generatedPriceRanges.length > 0) {
                    label = `₱ ${currentMin}+`;
                    rangeMax = Infinity; // Filter will be pricePerNight >= currentMin
                    generatedPriceRanges.push({ label, min: currentMin, max: rangeMax });
                    break;
                } else {
                    // For ranges in between: 2000 - 2999
                    const displayMax = currentMax - 1; // Subtract 1 for the label
                    label = `₱ ${currentMin} - ${displayMax}`;
                    rangeMax = currentMax; // Filter will still use `currentMax` as the exclusive upper bound
                    generatedPriceRanges.push({ label, min: currentMin, max: rangeMax });
                }

                currentMin = currentMax;
                currentMax += priceStep;
            }

            // Fallback for cases where no rooms fetched or all rooms are below fixedMinPrice but you still want 2000+
            if (generatedPriceRanges.length === 0) {
                generatedPriceRanges.push({ label: `₱ ${fixedMinPrice}+`, min: fixedMinPrice, max: Infinity });
            }

            setAvailablePriceRanges(generatedPriceRanges);

        } catch (err) {
            console.error("Failed to fetch and prepare rooms for AllRooms:", err);
            // This error is for network issues or non-200 HTTP codes
            setError('Failed to fetch rooms and ratings. Please check your backend server.');
            setLoading(false);
        }
    };
    fetchAndPrepareRooms();
}, []);

    // --- Filtering and Sorting Logic ---
    useEffect(() => {
    // Add a check to ensure `allRooms` is an array before proceeding.
    // This prevents the `TypeError` if the API call fails and returns
    // a non-array value.
    if (!Array.isArray(allRooms)) {
        console.error("allRooms is not an array. Skipping filtering and sorting.");
        setDisplayedRooms([]); // Optionally clear the displayed rooms
        return;
    }

    let filtered = [...allRooms];

    // 1. Apply Room Type Filter
    if (selectedRoomTypes.length > 0) {
        filtered = filtered.filter(room =>
            selectedRoomTypes.includes(room.roomType)
        );
    }

    // 2. Apply Price Range Filter
    if (selectedPriceRange) {
        const range = availablePriceRanges.find(r => r.label === selectedPriceRange);
        if (range) {
            filtered = filtered.filter(room =>
                room.pricePerNight >= range.min && room.pricePerNight < range.max
            );
        }
    }

    // 3. Apply Amenities Filter
    if (selectedAmenities.length > 0) {
        filtered = filtered.filter(room =>
            selectedAmenities.every(selectedAmenity =>
                room.amenities && Array.isArray(room.amenities) && room.amenities.includes(selectedAmenity)
            )
        );
    }

    // 4. Apply Sorting
    let sorted = [...filtered];
    if (currentSortOption === 'Price Low to High') {
        sorted.sort((a, b) => a.pricePerNight - b.pricePerNight);
    } else if (currentSortOption === 'Price High to Low') {
        sorted.sort((a, b) => b.pricePerNight - a.pricePerNight);
    } else if (currentSortOption === 'Newest First') {
        sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    setDisplayedRooms(sorted);
}, [allRooms, selectedRoomTypes, selectedPriceRange, selectedAmenities, currentSortOption, availablePriceRanges]);

    return (
        <div className="flex flex-col-reverse lg:flex-row items-start justify-between pt-28 md:pt-35 px-4 md:px-16 lg:px-24 xl:px-32">
            <div>
                <div className="flex flex-col items-start text-left">
                    <h1 className="font-playfair text-4xl md:text-[40px]">Hotel Rooms</h1>
                    <p className="text-sm md:text-base text-gray-500/90 mt-2">
                        Take advantage of our limited-time offers and special packages to enhance your stay and
                        create unforgettable memories.
                    </p>
                </div>

                {loading && <p className="mt-8 text-center w-full">Loading rooms...</p>}
                {error && <p className="mt-8 text-center w-full text-red-500">{error}</p>}
                {!loading && !error && displayedRooms.length === 0 && (
                    <p className="text-gray-600 mt-8 text-center w-full">
                        No rooms found matching your criteria. Try adjusting your filters.
                    </p>
                )}
                {!loading && !error && displayedRooms.length > 0 && (
                    <div className="w-full">
                        {displayedRooms.map((room) => {
                            const imageUrl = room.images && room.images.length > 0
                                 ? room.images[0]
                                : assets.placeholderRoomImage;

                            return (
                                <div
                                    key={room.id}
                                    className="flex flex-col md:flex-row items-start py-10 gap-6 border-b border-gray-300 last:pb-30 last:border-0"
                                >
                                    <img
                                        onClick={() => {
                                            navigate(`/rooms/${room.id}`);
                                            window.scrollTo(0, 0);
                                        }}
                                        src={imageUrl}
                                        alt={room.roomType || "hotel room"}
                                        title="View Room Details"
                                        className="max-h-65 md:w-1/2 rounded-xl shadow-lg object-cover cursor-pointer"
                                    />
                                    <div className="md:w-1/2 flex flex-col gap-2">
                                        <p
                                            onClick={() => {
                                                navigate(`/rooms/${room.id}`);
                                                window.scrollTo(0, 0);
                                            }}
                                            className="text-gray-800 text-3xl font-playfair cursor-pointer"
                                        >
                                            {room.roomType}
                                        </p>
                                        <div className="flex items-center">
                                            {console.log(`Debug - Room ID: ${room.id}, Average Rating: ${room.averageRating}, Review Count: ${room.reviewCount}`)}
                                                <StarRating rating={room.averageRating} />
                                            <span className="ml-2 text-gray-600">
                                                ({room.reviewCount} reviews)
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center mt-3 mb-6 gap-4">
                                            {/* Ensure amenities is an array before mapping */}
                                            {Array.isArray(room.amenities) && room.amenities.map((item, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F5F5FF]/70"
                                                >
                                                    {facilityIcons[item] && <img src={facilityIcons[item]} alt={item} className="w-5 h-5" />}
                                                    <p className="text-xs">{item}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <p className="text-xl font-medium text-gray-700">₱{room.pricePerNight} /night</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Filters and Sort Section */}
            <div className="bg-white w-80 border border-gray-300 text-gray-600 max-lg:mb-8 min-lg:mt-16">
                <div
                    className={`flex items-center justify-between px-5 py-2.5 min-lg:border-b border-gray-300 ${
                        openFilters && 'border-b'
                    }`}
                >
                    <p className="text-base font-medium text-gray-800">FILTERS</p>
                    <div className="text-xs cursor-pointer">
                        <span onClick={() => setOpenFilters(!openFilters)} className="lg:hidden">
                            {openFilters ? 'HIDE' : 'SHOW'}
                        </span>
                        <span onClick={handleClearFilters} className="hidden lg:block text-blue-600 hover:underline">CLEAR ALL</span>
                    </div>
                </div>

                <div
                    className={`
                        ${openFilters ? 'h-auto' : 'h-0 lg:h-auto'}
                        overflow-hidden transition-all duration-700
                    `}
                >
                    {/* Room Type Filter (Dynamic) */}
                    {availableRoomTypes.length > 0 && (
                        <div className="px-5 pt-5">
                            <p className="font-medium text-gray-800 pb-2">Room Type</p>
                            {availableRoomTypes.map((type, index) => (
                                <Checkbox
                                    key={index}
                                    label={type}
                                    selected={selectedRoomTypes.includes(type)}
                                    onChange={handleRoomTypeChange}
                                />
                            ))}
                        </div>
                    )}

                    {/* Price Range Filter (Dynamic) */}
                    {availablePriceRanges.length > 0 && (
                        <div className="px-5 pt-5">
                            <p className="font-medium text-gray-800 pb-2">Price Range</p>
                            {availablePriceRanges.map((range, index) => (
                                <Checkbox
                                    key={index}
                                    label={range.label}
                                    selected={selectedPriceRange === range.label}
                                    onChange={handlePriceRangeChange}
                                />
                            ))}
                        </div>
                    )}

                    {/* Amenities Filter (Dynamic) */}
                    {availableAmenities.length > 0 && (
                        <div className="px-5 pt-5">
                            <p className="font-medium text-gray-800 pb-2">Amenities</p>
                            {availableAmenities.map((amenity, index) => (
                                <Checkbox
                                    key={index}
                                    label={amenity}
                                    selected={selectedAmenities.includes(amenity)}
                                    onChange={handleAmenityChange}
                                />
                            ))}
                        </div>
                    )}

                    {/* Sort by */}
                    <div className="px-5 pt-5 pb-7">
                        <p className="font-medium text-gray-800 pb-2">Sort by</p>
                        {SORT_OPTIONS.map((option, index) => (
                            <RadioButton
                                key={index}
                                label={option}
                                selected={currentSortOption === option}
                                onChange={handleSortChange}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AllRooms;