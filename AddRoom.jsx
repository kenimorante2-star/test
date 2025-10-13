// src/pages/Admin/AddRoom.jsx
import React, { useState } from 'react';
import Title from '../../components/Title';
import { assets } from '../../assets/assets';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

const AddRoom = () => {
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [images, setImages] = useState({
    1: null, // Stores File objects
    2: null,
    3: null,
    4: null,
  });

  const [inputs, setInputs] = useState({
    roomType: '',
    pricePerNight: '',
    maxGuests: '',    // NEW: Added maxGuests state
    amenities: {
      'Free Wifi': false,
      'Free Breakfast': false,
      'Room Service': false,
    },
  });

  const [newAmenityName, setNewAmenityName] = useState('');

  const [notification, setNotification] = useState({
    message: '',
    type: '', // 'success' or 'error'
  });

  const [loading, setLoading] = useState(false);

  const handleImageChange = (e, key) => {
    if (e.target.files && e.target.files[0]) {
      setImages((prevImages) => ({
        ...prevImages,
        [key]: e.target.files[0],
      }));
    }
  };

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setInputs((prevInputs) => ({ ...prevInputs, [name]: value }));
  };

  const handleAddAmenity = () => {
    const trimmedAmenityName = newAmenityName.trim();
    if (trimmedAmenityName && !(trimmedAmenityName in inputs.amenities)) {
      setInputs((prevInputs) => ({
        ...prevInputs,
        amenities: {
          ...prevInputs.amenities,
          [trimmedAmenityName]: false, // Add as unchecked
        },
      }));
      setNewAmenityName(''); // Clear the input field
      setNotification({ message: `Amenity "${trimmedAmenityName}" added!`, type: 'success' });
      setTimeout(() => setNotification({ message: '', type: '' }), 2000);
    } else if (trimmedAmenityName && (trimmedAmenityName in inputs.amenities)) {
      setNotification({ message: `Amenity "${trimmedAmenityName}" already exists.`, type: 'error' });
      setTimeout(() => setNotification({ message: '', type: '' }), 3000);
    } else {
      setNotification({ message: 'Amenity name cannot be empty.', type: 'error' });
      setTimeout(() => setNotification({ message: '', type: '' }), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotification({ message: '', type: '' });
    setLoading(true);

    if (!isLoaded || !isSignedIn) {
      setNotification({ message: 'You must be signed in to add a room.', type: 'error' });
      setLoading(false);
      return;
    }

    if (!inputs.roomType || !inputs.pricePerNight || !inputs.maxGuests) { // NEW: Validate new fields
      setNotification({ message: 'Please fill in all required fields.', type: 'error' });
      setLoading(false);
      return;
    }

    const selectedAmenities = Object.keys(inputs.amenities).filter(
      (key) => inputs.amenities[key]
    );

    const formData = new FormData();
    formData.append('roomType', inputs.roomType);
    formData.append('pricePerNight', inputs.pricePerNight);
    formData.append('maxGuests', inputs.maxGuests);   // NEW: Append maxGuests
    formData.append('isAvailable', true); // Newly added rooms are available by default
    formData.append('amenities', JSON.stringify(selectedAmenities));

    // Append images
    Object.values(images).forEach((file) => {
      if (file) {
        formData.append('images', file);
      }
    });

    try {
      const token = await getToken();
      if (!token) {
        setNotification({ message: 'Authentication token missing. Please log in.', type: 'error' });
        setLoading(false);
        return;
      }

      const response = await axios.post(`${BACKEND_BASE_URL}/rooms`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      setNotification({ message: response.data.message || 'Room added successfully!', type: 'success' });
      // Reset form after successful submission
      setInputs({
        roomType: '',
        pricePerNight: '',
        maxGuests: '',  // Reset new fields
        amenities: {
          'Free Wifi': false,
          'Free Breakfast': false,
          'Room Service': false,
        },
      });
      setImages({ 1: null, 2: null, 3: null, 4: null }); // Clear image previews
    } catch (error) {
      console.error('Error adding room:', error.response?.data || error.message);
      setNotification({
        message: error.response?.data?.error || 'Failed to add room. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setTimeout(() => setNotification({ message: '', type: '' }), 5000); // Clear notification after 5 seconds
    }
  };

  return (
    <div className="p-4 md:p-8">
      <Title title="Add New Room Type" />

      {notification.message && (
        <div
          className={`p-3 mb-4 rounded ${notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          role="alert"
        >
          {notification.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6 bg-white shadow-md rounded-lg">
        {/* Room Images */}
         <p className="text-gray-800 mt-10">Images</p>
      <div className="grid grid-cols-2 sm:flex gap-4 my-2 flex-wrap">
        {Object.keys(images).map((key) => (
          <label htmlFor={`roomImages${key}`} key={key} className="cursor-pointer">
            <img
              className="max-h-32 w-full object-cover rounded-md shadow-sm opacity-80 hover:opacity-100 transition-opacity duration-200"
              src={images[key] ? URL.createObjectURL(images[key]) : assets.uploadArea}
              alt={`Upload area ${key}`}
            />
            <input
              type="file"
              accept="image/*"
              id={`roomImages${key}`}
              hidden
              onChange={(e) => handleImageChange(e, key)}
            />
          </label>
        ))}
      </div>


        {/* Room Type */}
        <div className="flex flex-col gap-2"> 
          <p className="text-gray-800 font-medium">Room Type</p> 
          <select name="roomType" onChange={onChangeHandler}
           value={inputs.roomType} 
           className="border border-gray-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" required > 
           <option value="">Select Room Type</option> 
           <option value="Standard Room">Standard Room</option> 
           <option value="Deluxe Room">Deluxe Room</option> 
           <option value="Family Room">Family Room</option> 
           </select> 
           </div>

        {/* Price Per Night */}
        <div className="w-full">
          <p className="font-semibold text-gray-700 mb-2">Price Per Night (₱)</p>
          <input
            type="number"
            name="pricePerNight"
            value={inputs.pricePerNight}
            onChange={(e) => setInputs({ ...inputs, pricePerNight: e.target.value })}
            placeholder="e.g., 2500"
            required
            min="0"
            step="0.01"
            className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Max Guests - NEW FIELD */}
        <div className="w-full">
          <p className="font-semibold text-gray-700 mb-2">Maximum Guests</p>
          <input
            type="number"
            name="maxGuests"
            value={inputs.maxGuests}
            onChange={(e) => setInputs({ ...inputs, maxGuests: e.target.value })}
            placeholder="e.g., 2, 4"
            required
            min="1"
            className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Amenities */}
        <div className="w-full">
          <p className="font-semibold text-gray-700 mb-2">Amenities</p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Add new amenity"
              value={newAmenityName}
              onChange={(e) => setNewAmenityName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // Prevent form submission
                  handleAddAmenity();
                }
              }}
              className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary flex-grow"
            />
            <button
              type="button"
              onClick={handleAddAmenity}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors duration-200"
            >
              Add
            </button>
          </div>

          <div className="flex flex-col flex-wrap mt-1 text-gray-700 max-w-sm">
            {Object.keys(inputs.amenities).map((amenity) => (
              <div key={amenity} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`amenities${amenity.replace(/\s/g, '')}`}
                  checked={inputs.amenities[amenity]}
                  onChange={() =>
                    setInputs({
                      ...inputs,
                      amenities: {
                        ...inputs.amenities,
                        [amenity]: !inputs.amenities[amenity],
                      },
                    })
                  }
                  className="form-checkbox h-4 w-4 text-primary rounded focus:ring-primary"
                />
                <label htmlFor={`amenities${amenity.replace(/\s/g, '')}`} className="cursor-pointer"> {amenity}</label>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="bg-primary text-white px-8 py-2 rounded mt-8 cursor-pointer hover:bg-primary-dull transition-colors duration-200"
          disabled={loading}
        >
          {loading ? 'Adding Room...' : 'Add Room'}
        </button>
      </form>
    </div>
  );
};

export default AddRoom;