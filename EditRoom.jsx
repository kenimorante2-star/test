import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from '@clerk/clerk-react';

// Assuming facilityIcons is still used for initial/default amenities.
// In a real application, you would import this from a file like:
import { facilityIcons } from "../../assets/assets";


const EditRoom = ({ selectedRoom, onClose, onSave }) => {
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
    // State to hold the room data being edited
    const [roomData, setRoomData] = useState({
        roomType: "",
        pricePerNight: "",
        amenities: [],
        isAvailable: true,
        maxGuests: "",
    });

    // State for the new amenity input field
    const [newAmenityName, setNewAmenityName] = useState('');
    // State for notifications (success/error messages)
    const [notification, setNotification] = useState({ message: '', type: '' });
    // State for loading indicator on save button
    const [loading, setLoading] = useState(false);

    // Clerk hook to get authentication token
    const { getToken } = useAuth();

    // Effect to populate the form when a room is selected or changes
    useEffect(() => {
        if (selectedRoom) {
            // Ensure amenities are an array and isAvailable is correctly initialized
            setRoomData({
                roomType: selectedRoom.roomType || "",
                pricePerNight: selectedRoom.pricePerNight || "",
                // Ensure amenities is an array, defaulting to empty if not
                amenities: Array.isArray(selectedRoom.amenities) ? selectedRoom.amenities : [],
                // Convert backend's 0/1 to boolean for checkbox
                isAvailable: selectedRoom.isAvailable === 1,
                maxGuests: selectedRoom.maxGuests || "",
            });
        }
    }, [selectedRoom]); // Re-run when selectedRoom changes

    // Handles changes for roomType and pricePerNight inputs
    const handleChange = (e) => {
        const { name, value } = e.target;
        setRoomData((prev) => ({
            ...prev,
            // Convert pricePerNight to a number
            [name]: (name === "pricePerNight" || name === "maxGuests") ? (value === "" ? "" : Number(value)) : value,
        }));
    };

    // Handles changes for amenity checkboxes
    const handleAmenityChange = (amenity) => {
        setRoomData((prev) => {
            // Toggle amenity in the amenities array
            const amenities = prev.amenities.includes(amenity)
                ? prev.amenities.filter((a) => a !== amenity) // Remove if already present
                : [...prev.amenities, amenity]; // Add if not present
            return { ...prev, amenities };
        });
    };

    // Function to handle adding a new amenity from the input field
    const handleAddAmenity = () => {
        const trimmedAmenityName = newAmenityName.trim(); // Trim whitespace
        // Check if amenity name is not empty and not already in the list
        if (trimmedAmenityName && !roomData.amenities.includes(trimmedAmenityName)) {
            setRoomData((prev) => ({
                ...prev,
                amenities: [...prev.amenities, trimmedAmenityName], // Add new amenity to the array
            }));
            setNewAmenityName(''); // Clear the input field
            setNotification({ message: `Amenity "${trimmedAmenityName}" added!`, type: 'success' });
            setTimeout(() => setNotification({ message: '', type: '' }), 2000); // Hide notification after 2 seconds
        } else if (trimmedAmenityName && roomData.amenities.includes(trimmedAmenityName)) {
            // Show error if amenity already exists
            setNotification({ message: `Amenity "${trimmedAmenityName}" already exists.`, type: 'error' });
            setTimeout(() => setNotification({ message: '', type: '' }), 3000); // Hide notification after 3 seconds
        } else {
            // Show error if input is empty
            setNotification({ message: 'Amenity name cannot be empty.', type: 'error' });
            setTimeout(() => setNotification({ message: '', type: '' }), 3000); // Hide notification after 3 seconds
        }
    };

    // Handles saving the changes to the room
    const handleSave = async () => {
        setLoading(true); // Set loading state to true
        setNotification({ message: '', type: '' }); // Clear any previous notifications

        try {
            const token = await getToken(); // Get authentication token
            if (!token) {
                setNotification({ message: 'Authentication token missing. Please log in.', type: 'error' });
                setLoading(false);
                return;
            }

            // Prepare the updated room object to send to the API
            const updatedRoom = {
                id: selectedRoom.id, // IMPORTANT: Include the room ID
                roomType: roomData.roomType,
                pricePerNight: roomData.pricePerNight,
                amenities: roomData.amenities, // Amenities are already an array
                images: selectedRoom.images || [], // Retain existing images
                owner: selectedRoom.owner || {}, // Retain existing owner information
                isAvailable: roomData.isAvailable, // Boolean value
                maxGuests: roomData.maxGuests,
            };

            console.log("Sending PUT request with:", updatedRoom);

            // Make the PUT request to update the room
            await axios.put(`${BACKEND_URL}/rooms/${selectedRoom.id}`, updatedRoom, {
                headers: {
                    Authorization: `Bearer ${token}` // Include authorization token
                }
            });

            setNotification({ message: 'Room updated successfully!', type: 'success' });
            if (onSave) onSave(updatedRoom); // Call onSave to trigger parent re-fetch/update and pass the updated room
            onClose(); // Automatically close the modal after successful save

        } catch (err) {
            console.error("Failed to save room:", err.response ? err.response.data : err.message);
            // Extract and display error message from the response
            const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to update room.';
            setNotification({ message: errorMessage, type: 'error' });
        } finally {
            setLoading(false); // Set loading state to false
            setTimeout(() => setNotification({ message: '', type: '' }), 3000); // Hide notification after 3 seconds
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg overflow-y-auto max-h-[90vh]">
                <h2 className="text-2xl font-bold mb-4 font-inter text-gray-800">Edit Room</h2>

                {/* Notification Area */}
                {notification.message && (
                    <div
                        className={`mb-4 p-3 rounded-md text-sm font-medium ${
                            notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                    >
                        {notification.message}
                    </div>
                )}

                {/* Room Type Selection */}
                <label className="block mb-4 text-gray-700">
                    Room Type:
                    <select
                        name="roomType"
                        value={roomData.roomType}
                        onChange={handleChange}
                        className="w-full border border-gray-300 p-2 rounded-md mt-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                    >
                        <option value="">Select Room Type</option>
                        <option value="Standard Room">Standard Room</option>
                        <option value="Deluxe Room">Deluxe Room</option>
                        <option value="Family Room">Family Room</option>
                    </select>
                </label>

                {/* Price Per Night Input */}
                <label className="block mb-4 text-gray-700">
                    Price Per Night:
                    <input
                        type="number"
                        name="pricePerNight"
                        value={roomData.pricePerNight}
                        onChange={handleChange}
                        className="w-full border border-gray-300 p-2 rounded-md mt-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                        min={0} // Ensure price cannot be negative
                    />
                </label>

                {/* Max Guests Input */}
                <label className="block mb-4 text-gray-700">
                    Maximum Guests:
                    <input
                        type="number"
                        name="maxGuests"
                        value={roomData.maxGuests}
                        onChange={handleChange}
                        className="w-full border border-gray-300 p-2 rounded-md mt-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                        min={1} // Ensure max guests is at least 1
                    />
                </label>

                {/* Amenities Section */}
                <div className="mb-4">
                    <label className="block mb-2 font-medium text-gray-700">Amenities:</label>
                    {/* Input and button for adding new amenities */}
                    <div className="flex gap-2 mb-4 items-center">
                        <input
                            type="text"
                            placeholder="Add new amenity"
                            value={newAmenityName}
                            onChange={(e) => setNewAmenityName(e.target.value)}
                            className="border border-gray-300 rounded-md p-2 flex-grow focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                        />
                        <button
                            type="button" // Important: type="button" to prevent form submission
                            onClick={handleAddAmenity}
                            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors duration-200 shadow-sm"
                        >
                            Add
                        </button>
                    </div>

                    {/* List of existing and added amenities with checkboxes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-40 overflow-y-auto border border-gray-200 p-3 rounded-md bg-gray-50">
                        {/* Combine initial facilityIcons with dynamically added amenities, ensuring uniqueness */}
                        {[...new Set([...Object.keys(facilityIcons), ...roomData.amenities])].map((amenity) => (
                            <label key={amenity} className="flex items-center space-x-2 text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded-md transition-colors duration-150">
                                <input
                                    type="checkbox"
                                    checked={roomData.amenities.includes(amenity)}
                                    onChange={() => handleAmenityChange(amenity)}
                                    className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                {facilityIcons[amenity] && ( // Only show icon if it exists in facilityIcons
                                    <img src={facilityIcons[amenity]} alt={amenity} className="w-5 h-5 object-contain" />
                                )}
                                <span className="text-sm">{amenity}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Is Available Checkbox */}
                <div className="mb-6">
                    <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                        <input
                            type="checkbox"
                            name="isAvailable"
                            checked={roomData.isAvailable}
                            onChange={(e) => setRoomData(prev => ({ ...prev, isAvailable: e.target.checked }))}
                            className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-base font-medium">Available for Booking</span>
                    </label>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4">
                    <button
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-200 shadow-sm"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleSave}
                        disabled={loading} // Disable button while saving
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditRoom;
