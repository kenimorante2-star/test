// src/pages/Admin/PhysicalRooms.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const PhysicalRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [physicalRooms, setPhysicalRooms] = useState([]);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedPhysicalRoomForStatusChange, setSelectedPhysicalRoomForStatusChange] = useState(null);
  const [newPhysicalRoomStatus, setNewPhysicalRoomStatus] = useState('');
  const [showAddPhysicalRoomModal, setShowAddPhysicalRoomModal] = useState(false);
  const [newPhysicalRoomNumber, setNewPhysicalRoomNumber] = useState('');
  const [selectedRoomTypeForPhysical, setSelectedRoomTypeForPhysical] = useState('');

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

  const fetchPhysicalRooms = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const token = await getToken();
      const res = await axios.get(`${BACKEND_URL}/physical-rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPhysicalRooms(res.data);
    } catch (error) {
      console.error('Failed to fetch physical rooms:', error);
      setNotification({ message: 'Failed to fetch physical rooms.', type: 'error' });
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    fetchRooms();
    fetchPhysicalRooms();

    const socket = io(BACKEND_URL);

    socket.on('connect', () => {
      console.log('Socket.IO connected from PhysicalRooms');
    });

    socket.on('physicalRoomAdded', (newRoom) => {
      setPhysicalRooms((prev) => [...prev, newRoom]);
    });

    socket.on('physicalRoomStatusUpdated', (updatedRoom) => {
      setPhysicalRooms((prev) =>
        prev.map((room) => (room.id === updatedRoom.id ? { ...room, status: updatedRoom.status } : room))
      );
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected from PhysicalRooms');
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchRooms, fetchPhysicalRooms]);

  const handleAddPhysicalRoomClick = () => {
    setShowAddPhysicalRoomModal(true);
    setNewPhysicalRoomNumber('');
    setSelectedRoomTypeForPhysical('');
  };

  const handleCloseAddPhysicalRoomModal = () => {
    setShowAddPhysicalRoomModal(false);
  };

  const handleSavePhysicalRoom = async (e) => {
    e.preventDefault();
    if (!newPhysicalRoomNumber.trim() || !selectedRoomTypeForPhysical) {
      setNotification({ message: 'Please enter a room number and select a room type.', type: 'error' });
      setTimeout(() => setNotification({ message: '', type: '' }), 3000);
      return;
    }

    setLoading(true);
    setNotification({ message: '', type: '' });
    try {
      const token = await getToken();
      await axios.post(
        `${BACKEND_URL}/physical-rooms`,
        {
          roomTypeId: selectedRoomTypeForPhysical,
          roomNumber: newPhysicalRoomNumber.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setNotification({ message: 'Physical room added successfully!', type: 'success' });
      fetchPhysicalRooms();
      handleCloseAddPhysicalRoomModal();
    } catch (error) {
      console.error('Failed to add physical room:', error.response?.data || error.message);
      const errorMessage =
        error.response?.data?.error || error.response?.data?.message || 'Failed to add physical room.';
      setNotification({ message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setNotification({ message: '', type: '' }), 3000);
    }
  };

  const handleChangeStatusClick = (physicalRoom) => {
    setSelectedPhysicalRoomForStatusChange(physicalRoom);
    setNewPhysicalRoomStatus(physicalRoom.status);
    setShowStatusModal(true);
  };

  const handleCloseStatusModal = () => {
    setShowStatusModal(false);
    setSelectedPhysicalRoomForStatusChange(null);
    setNewPhysicalRoomStatus('');
  };

  const handleSaveStatusChange = async () => {
    if (!selectedPhysicalRoomForStatusChange || !newPhysicalRoomStatus) {
      setNotification({ message: 'Please select a status.', type: 'error' });
      setTimeout(() => setNotification({ message: '', type: '' }), 3000);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      await axios.patch(
        `${BACKEND_URL}/physical-rooms/${selectedPhysicalRoomForStatusChange.id}/status`,
        { status: newPhysicalRoomStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setNotification({
        message: `Status of room ${selectedPhysicalRoomForStatusChange.room_number} updated to ${newPhysicalRoomStatus}!`,
        type: 'success',
      });
      handleCloseStatusModal();
      fetchPhysicalRooms();
    } catch (error) {
      console.error('Failed to update physical room status:', error.response?.data || error.message);
      setNotification({
        message: `Failed to update status: ${error.response?.data?.error || error.message}`,
        type: 'error',
      });
    } finally {
      setLoading(false);
      setTimeout(() => setNotification({ message: '', type: '' }), 3000);
    }
  };

  return (
    <div className="pt-6 md:pt-8 px-4 md:px-8 lg:px-12 xl:px-16">
      <h1 className="text-3xl md:text-4xl font-playfair mb-6">Physical Rooms Inventory</h1>
      <p className="text-sm text-gray-600">Manage the status and details of individual physical rooms.</p>

      {/* Notification Area */}
      {notification.message && (
        <div
          className={`mt-4 p-3 rounded text-white ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Physical Rooms Section */}
      <h2 className="text-2xl font-playfair mt-10 mb-4">Physical Rooms Inventory</h2>
      <button
        onClick={handleAddPhysicalRoomClick}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors cursor-pointer"
        disabled={loading}
      >
        Add New Physical Room
      </button>
      <div className="w-full max-w-5xl text-left border border-gray-300 rounded-lg max-h-[450px] overflow-y-scroll mt-3">
        <table className="w-full">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="py-3 px-4 text-gray-800 font-medium">Room Number</th>
              <th className="py-3 px-4 text-gray-800 font-medium">Room Type</th>
              <th className="py-3 px-4 text-gray-800 font-medium">Status</th>
              <th className="py-3 px-4 text-gray-800 font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {physicalRooms.map((room) => (
              <tr key={room.id} className="border-b border-gray-200 last:border-b-0">
                <td className="py-3 px-4 text-gray-700">{room.room_number}</td>
                <td className="py-3 px-4 text-gray-700">{room.roomType}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold
                                        ${
                                          room.status === 'available'
                                            ? 'bg-green-100 text-green-800'
                                            : room.status === 'occupied'
                                              ? 'bg-yellow-100 text-yellow-800'
                                              : 'bg-red-100 text-red-800'
                                        }`}
                  >
                    {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => handleChangeStatusClick(room)}
                    className="text-blue-600 hover:underline mr-4 cursor-pointer"
                    disabled={loading || room.status === 'occupied'}
                    title={room.status === 'occupied' ? 'Cannot change status while occupied by a booking' : 'Toggle status'}
                  >
                    Change Status
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showStatusModal && selectedPhysicalRoomForStatusChange && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative">
            <button
              onClick={handleCloseStatusModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold"
              aria-label="Close status modal"
            >
              &times;
            </button>
            <h3 className="text-2xl font-playfair mb-4 text-gray-800">
              Change Status for Room {selectedPhysicalRoomForStatusChange.room_number}
            </h3>
            <div className="mb-4">
              <label htmlFor="statusSelect" className="block text-gray-700 text-sm font-bold mb-2">
                New Status:
              </label>
              <select
                id="statusSelect"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={newPhysicalRoomStatus}
                onChange={(e) => setNewPhysicalRoomStatus(e.target.value)}
                required
              >
                <option value="available">Available</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseStatusModal}
                className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200 ease-in-out"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStatusChange}
                className="px-5 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition duration-200 ease-in-out"
                disabled={loading}
              >
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddPhysicalRoomModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative">
            {notification.message && (
              <div
                className={`mb-4 p-2 rounded text-white ${
                  notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                }`}
              >
                {notification.message}
              </div>
            )}
            <button
              onClick={handleCloseAddPhysicalRoomModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold"
              aria-label="Close add physical room modal"
            >
              &times;
            </button>
            <h3 className="text-2xl font-playfair mb-4 text-gray-800">Add New Physical Room</h3>
            <form onSubmit={handleSavePhysicalRoom}>
              <div className="mb-4">
                <label htmlFor="physicalRoomType" className="block text-gray-700 text-sm font-bold mb-2">
                  Room Type:
                </label>
                <select
                  id="physicalRoomType"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={selectedRoomTypeForPhysical}
                  onChange={(e) => setSelectedRoomTypeForPhysical(e.target.value)}
                  required
                >
                  <option value="">Select a Room Type</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.roomType}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="newPhysicalRoomNumber" className="block text-gray-700 text-sm font-bold mb-2">
                  Room Number:
                </label>
                <input
                  type="text"
                  id="newPhysicalRoomNumber"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={newPhysicalRoomNumber}
                  onChange={(e) => setNewPhysicalRoomNumber(e.target.value)}
                  placeholder="e.g., 101, A-205"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseAddPhysicalRoomModal}
                  className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition duration-200 ease-in-out"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition duration-200 ease-in-out"
                  disabled={loading}
                >
                  Add Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhysicalRooms;