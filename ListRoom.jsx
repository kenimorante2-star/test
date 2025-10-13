// src/pages/Admin/RoomTypes.jsx

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import EditRoom from './EditRoom';
import { useAuth } from '@clerk/clerk-react';
import { assets } from '../../assets/assets';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const AddRoomModal = ({ onClose, onRoomAdded }) => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [images, setImages] = useState({
    1: null,
    2: null,
    3: null,
    4: null,
  });
  const [inputs, setInputs] = useState({
    roomType: '',
    pricePerNight: '',
    maxGuests: '',
    amenities: {
      'Free Wifi': false,
      'Free Breakfast': false,
      'Room Service': false,
    },
  });
  const [newAmenityName, setNewAmenityName] = useState('');
  const [notification, setNotification] = useState({
    message: '',
    type: '',
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
          [trimmedAmenityName]: false,
        },
      }));
      setNewAmenityName('');
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

    if (!inputs.roomType || !inputs.pricePerNight || !inputs.maxGuests) {
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
    formData.append('maxGuests', inputs.maxGuests);
    formData.append('isAvailable', true);
    formData.append('amenities', JSON.stringify(selectedAmenities));

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

       const response = await axios.post(`${BACKEND_URL}/rooms`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      setNotification({ message: response.data.message || 'Room added successfully!', type: 'success' });
      onRoomAdded();
      setInputs({
        roomType: '',
        pricePerNight: '',
        maxGuests: '',
        amenities: {
          'Free Wifi': false,
          'Free Breakfast': false,
          'Room Service': false,
        },
      });
      setImages({ 1: null, 2: null, 3: null, 4: null });
      setTimeout(() => {
        onClose();
        setNotification({ message: '', type: '' });
      }, 2000);
    } catch (error) {
      console.error('Error adding room:', error.response?.data || error.message);
      setNotification({
        message: error.response?.data?.error || 'Failed to add room. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setTimeout(() => setNotification({ message: '', type: '' }), 5000);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-4xl w-full relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold"
          aria-label="Close add room modal"
        >
          &times;
        </button>
        <h3 className="text-2xl font-playfair mb-4 text-gray-800">Add New Room Type</h3>

        {notification.message && (
          <div
            className={`p-3 mb-4 rounded ${
              notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
            role="alert"
          >
            {notification.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6 bg-white rounded-lg">
          <p className="text-gray-800">Images</p>
          <div className="grid grid-cols-2 sm:flex gap-13 my-2">
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

          <div className="flex flex-col gap-2">
            <p className="text-gray-800 font-medium">Room Type</p>
            <select
              name="roomType"
              onChange={onChangeHandler}
              value={inputs.roomType}
              className="border border-gray-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Select Room Type</option>
              <option value="Standard Room">Standard Room</option>
              <option value="Deluxe Room">Deluxe Room</option>
              <option value="Family Room">Family Room</option>
            </select>
          </div>

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
                    e.preventDefault();
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
                  <label htmlFor={`amenities${amenity.replace(/\s/g, '')}`} className="cursor-pointer">
                    {' '}
                    {amenity}
                  </label>
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
    </div>
  );
};

const RoomTypes = () => {
  const [rooms, setRooms] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRoomForEdit, setSelectedRoomForEdit] = useState(null);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);

  const { getToken, isLoaded, isSignedIn } = useAuth();

  const fetchRooms = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/rooms`);
      setRooms(res.data);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      setNotification({ message: 'Failed to fetch rooms.', type: 'error' });
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleAvailabilityToggle = async (roomId, currentStatus) => {
    if (!isLoaded || !isSignedIn) {
      setNotification({ message: 'You must be signed in to change room availability.', type: 'error' });
      return;
    }
    setLoading(true);
    setNotification({ message: '', type: '' });
    try {
      const token = await getToken();
      if (!token) {
        setNotification({ message: 'Authentication token missing. Please log in.', type: 'error' });
        setLoading(false);
        return;
      }

      const res = await axios.patch(
        `${BACKEND_URL}/rooms/${roomId}`,
        {
          isAvailable: !currentStatus,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.status === 200) {
        setRooms((prevRooms) =>
          prevRooms.map((room) => (room.id === roomId ? { ...room, isAvailable: !currentStatus ? 1 : 0 } : room))
        );
        setNotification({ message: 'Room availability updated successfully!', type: 'success' });
      } else {
        console.error('Failed to update availability: status', res.status);
        setNotification({ message: 'Failed to update availability.', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to update availability:', error.response ? error.response.data : error.message);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to update availability.';
      setNotification({ message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setNotification({ message: '', type: '' }), 3000);
    }
  };

  const handleEditClick = (room) => {
    if (!isLoaded || !isSignedIn) {
      setNotification({ message: 'You must be signed in to edit a room.', type: 'error' });
      return;
    }
    setSelectedRoomForEdit(room);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedRoomForEdit(null);
  };

  const handleSaveEdit = async (updatedRoom) => {
    if (!isLoaded || !isSignedIn) {
      setNotification({ message: 'You must be signed in to save changes.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      await axios.put(`${BACKEND_URL}/rooms/${updatedRoom.id}`, updatedRoom, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      setNotification({ message: 'Room updated successfully!', type: 'success' });
      fetchRooms();
      handleCloseEditModal();
    } catch (error) {
      console.error('Failed to update room:', error.response ? error.response.data : error.message);
      setNotification({
        message: `Failed to update room: ${error.response?.data?.error || error.message}`,
        type: 'error',
      });
    } finally {
      setLoading(false);
      setTimeout(() => setNotification({ message: '', type: '' }), 3000);
    }
  };

  return (
    <div className="pt-6 md:pt-8 px-4 md:px-8 lg:px-12 xl:px-16">
      <h1 className="text-3xl md:text-4xl font-playfair mb-6">Room Types</h1>
      <p className="text-sm text-gray-600">Manage the different types of rooms available at your hotel.</p>

      {notification.message && (
        <div
          className={`mt-4 p-3 rounded text-white ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {notification.message}
        </div>
      )}

      <h2 className="text-2xl font-playfair mt-10 mb-2">Room Types</h2>
      <button
        onClick={() => {
          if (!isLoaded || !isSignedIn) {
            setNotification({ message: 'You must be signed in to add a new room type.', type: 'error' });
            return;
          }
          setShowAddRoomModal(true);
        }}
        className="px-4 py-2 mb-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors cursor-pointer"
        disabled={loading}
      >
        Add New Room Type
      </button>

      <div className="w-full max-w-5xl text-left border border-gray-300 rounded-lg max-h-[450px] overflow-y-scroll mt-3">
        <table className="w-full">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="py-3 px-4 text-gray-800 font-medium">Name</th>
              <th className="py-3 px-4 text-gray-800 font-medium max-sm:hidden">Facility</th>
              <th className="py-3 px-4 text-gray-800 font-medium">Price / night</th>
              <th className="py-3 px-4 text-gray-800 font-medium">Available for Booking</th>
              <th className="py-3 px-4 text-gray-800 font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rooms.map((item) => (
              <tr key={item.id} className="border-b border-gray-200 last:border-b-0">
                <td className="py-3 px-4 text-gray-700">{item.roomType}</td>
                <td className="py-3 px-4 text-gray-700 max-sm:hidden">{item.amenities?.join(', ')}</td>
                <td className="py-3 px-4 text-gray-700">₱{item.pricePerNight}</td>
                <td className="py-3 px-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={item.isAvailable === 1}
                      onChange={() => handleAvailabilityToggle(item.id, item.isAvailable === 1)}
                      disabled={loading || !isLoaded || !isSignedIn}
                    />
                    <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600"></div>
                    <span className="dot absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-full"></span>
                  </label>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => handleEditClick(item)}
                    className="text-blue-600 hover:underline mr-4 cursor-pointer"
                    disabled={loading || !isLoaded || !isSignedIn}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEditModal && selectedRoomForEdit && (
        <EditRoom selectedRoom={selectedRoomForEdit} onClose={handleCloseEditModal} onSave={handleSaveEdit} />
      )}

      {showAddRoomModal && <AddRoomModal onClose={() => setShowAddRoomModal(false)} onRoomAdded={fetchRooms} />}
    </div>
  );
};

export default RoomTypes;