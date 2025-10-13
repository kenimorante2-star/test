import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { differenceInDays } from 'date-fns';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const History = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'online', 'walk-in'
  const itemsPerPage = 10;

  // State for the details modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);

  const fetchHistoryBookings = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
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

      // Construct the API endpoint with query parameters for search and pagination
      const response = await axios.get(`${BACKEND_URL}/admin/checked-out-bookings`, {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm,
          type: filterType
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setHistoryData(response.data.bookings);
      setTotalPages(response.data.totalPages);

    } catch (err) {
      console.error('Failed to fetch history bookings:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Failed to fetch history data.');
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, getToken, currentPage, searchTerm, filterType]);

  useEffect(() => {
    fetchHistoryBookings();
  }, [fetchHistoryBookings]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleFilterChange = (e) => {
    setFilterType(e.target.value);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handlePreviousPage = () => {
    setCurrentPage(prevPage => Math.max(prevPage - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prevPage => Math.min(prevPage + 1, totalPages));
  };

  // Function to open the details modal
  const handleShowDetails = (booking) => {
    setSelectedBookingDetails(booking);
    setShowDetailsModal(true);
  };

  // Function to close the details modal
  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedBookingDetails(null);
  };

  // Add this function from Dashboard.jsx
 const handlePrintWalkInReceipt = (booking) => {
    const paymentStatusDisplay = booking.isPaid ? 'Paid' : 'Not Paid';

    // Calculate nights based on the original booking dates
    let nights = booking.nights;
    if (booking.checkInDate && booking.checkOutDate) {
      const start = new Date(booking.checkInDate);
      const end = new Date(booking.checkOutDate);
      if (!isNaN(start) && !isNaN(end)) {
        nights = differenceInDays(end, start);
      }
    }

    const totalRoomCharge = (parseFloat(booking.roomPrice || 0) * parseInt(nights || 0)).toFixed(2);
    const lateCheckOutFee = parseFloat(booking.lateCheckOutFee || 0).toFixed(2);
    const earlyCheckInFee = parseFloat(booking.earlyCheckInFee || 0).toFixed(2);
    const totalPrice = parseFloat(booking.totalPrice).toFixed(2);
    const amountPaid = parseFloat(booking.amountPaid || 0).toFixed(2);
    const balanceDue = (parseFloat(booking.totalPrice) - parseFloat(booking.amountPaid || 0)).toFixed(2);
    
    // Helper function to format date or show "N/A"
    const formatDate = (dateValue) => {
      const date = new Date(dateValue);
      return !isNaN(date) ? date.toLocaleString() : 'N/A';
    };

    // Use actual check-in/out times for display with fallback
    const displayCheckInDate = booking.actual_check_in_time || booking.checkInDate;
    const displayCheckOutDate = booking.actual_check_out_time || booking.checkOutDate;
    
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
          
          <p class="item"><span>Check-in:</span> <span>${formatDate(displayCheckInDate)}</span></p>
          <p class="item"><span>Check-out:</span> <span>${formatDate(displayCheckOutDate)}</span></p>
          
          <hr>
          <p class="item"><span>Nights:</span> <span>${nights}</span></p>
          <p class="item"><span>Price/Night:</span> <span>₱${parseFloat(booking.roomPrice || 0).toFixed(2)}</span></p>
          <p class="item"><span>Late Check-out Fee:</span> <span>₱${lateCheckOutFee}</span></p>
          <p class="item"><span>Early Check-in Fee:</span> <span>₱${earlyCheckInFee}</span></p>
          <p class="item"><span>Total Room Charge:</span> <span>₱${totalRoomCharge}</span></p>
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
  
  if (!isLoaded || !isSignedIn) {
    return <div className="p-8 text-center">Loading history...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 bg-gray-50 min-h-screen">
      <h1 className="text-3xl md:text-4xl font-playfair mb-8 text-gray-800">Booking History</h1>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row justify-between mb-6">
        <input
          type="text"
          placeholder="Search by user or room type..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="p-2 border border-gray-300 rounded-md mb-4 md:mb-0 md:w-1/2"
        />
        <select
          value={filterType}
          onChange={handleFilterChange}
          className="p-2 border border-gray-300 rounded-md md:w-1/4"
        >
          <option value="all">All Bookings</option>
          <option value="online">Online Bookings</option>
          <option value="walk-in">Walk-in Bookings</option>
        </select>
      </div>

      {/* Bookings Table */}
      <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
        {loading ? (
          <p className="text-center py-4">Loading history...</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room No.</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-out Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference #</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th> {/* NEW COLUMN */}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {historyData.length > 0 ? (
                historyData.map((booking) => (
                  <tr key={booking.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                      {booking.firstName} {booking.lastName}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">{booking.roomType}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">{booking.physicalRoomNumber || 'N/A'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                        {new Date(booking.checkInDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                        {new Date(booking.checkOutDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">₱{parseFloat(booking.totalPrice).toFixed(2)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">{booking.paymentReference || '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">{booking.claimedAmount !== null && booking.claimedAmount !== undefined ? `₱${parseFloat(booking.claimedAmount).toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-center text-xs font-medium">
                        
                        <button
                            onClick={() => handleShowDetails(booking)}
                            className="text-indigo-600 hover:text-indigo-900 mr-2 cursor-pointer"
                        >
                            Show Details
                        </button>
                        <button
                            onClick={() => handlePrintWalkInReceipt(booking)}
                            className="text-blue-600 hover:text-blue-900 mr-2"
                        >
                            Receipt
                        </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-4 text-center text-gray-500">No checked-out bookings found.</td> {/* Updated colspan */}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-6">
        <button
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
          className="px-4 py-2 text-xs font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-xs text-gray-700">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          className="px-4 py-2 text-xs font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Booking Details Modal */}
      {showDetailsModal && selectedBookingDetails && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Booking Details for {selectedBookingDetails.firstName} {selectedBookingDetails.lastName}</h3>
              <button onClick={handleCloseDetailsModal} className="text-gray-500 hover:text-gray-800">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* General Details */}
              <div className="border p-4 rounded-lg">
                <h4 className="font-semibold text-lg mb-2">Booking Information</h4>
                <p><strong>Booking ID:</strong> {selectedBookingDetails.id}</p>
                <p><strong>Status:</strong> {selectedBookingDetails.status}</p>
                <p><strong>Guests:</strong> {selectedBookingDetails.guests}</p>
                <p>
                    <strong>Check-in:</strong> {selectedBookingDetails.actual_check_in_time 
                        ? new Date(selectedBookingDetails.actual_check_in_time).toLocaleString()
                        : new Date(selectedBookingDetails.checkInDate).toLocaleString()}
                </p>
                <p>
                    <strong>Check-out:</strong> {selectedBookingDetails.actual_check_out_time
                        ? new Date(selectedBookingDetails.actual_check_out_time).toLocaleString()
                        : new Date(selectedBookingDetails.checkOutDate).toLocaleString()}
                </p>
                <p><strong>Nights:</strong> {selectedBookingDetails.nights !== null ? selectedBookingDetails.nights :
                    (differenceInDays(new Date(selectedBookingDetails.checkOutDate), new Date(selectedBookingDetails.checkInDate)) || 'N/A')}
                </p>
              </div>

              {/* User Details (conditional for online vs walk-in) */}
              <div className="border p-4 rounded-lg">
                <h4 className="font-semibold text-lg mb-2">Guest Information</h4>
                <p><strong>Name:</strong> {selectedBookingDetails.firstName} {selectedBookingDetails.lastName}</p>
                {selectedBookingDetails.userId && ( // Only show User ID for online bookings
                    <p><strong>User ID:</strong> {selectedBookingDetails.userId}</p>
                )}
                <p><strong>Email:</strong> {selectedBookingDetails.email || 'N/A'}</p>
                <p><strong>Phone:</strong> {selectedBookingDetails.phone || 'N/A'}</p>
                {selectedBookingDetails.idPictureUrl && (
                    <p>
                        <strong>ID Picture:</strong>{' '}
                        <a
                            href={`${BACKEND_URL}${selectedBookingDetails.idPictureUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                        >
                            View ID
                        </a>
                    </p>
                )}
              </div>

              {/* Room Details */}
              <div className="border p-4 rounded-lg">
                <h4 className="font-semibold text-lg mb-2">Room Details</h4>
                <p><strong>Room Type:</strong> {selectedBookingDetails.roomType}</p>
                <p><strong>Room Number:</strong> {selectedBookingDetails.physicalRoomNumber || 'N/A'}</p>
                <p><strong>Price per Night:</strong> ₱{parseFloat(selectedBookingDetails.roomPrice || 0).toFixed(2)}</p>
              </div>

              {/* Payment Details */}
              <div className="border p-4 rounded-lg">
                <h4 className="font-semibold text-lg mb-2">Payment Details</h4>
                <p><strong>Total Price:</strong> ₱{parseFloat(selectedBookingDetails.totalPrice || 0).toFixed(2)}</p>
                <p><strong>Amount Paid:</strong> ₱{parseFloat(selectedBookingDetails.amountPaid || 0).toFixed(2)}</p>
                <p><strong>Balance:</strong> ₱{(parseFloat(selectedBookingDetails.totalPrice || 0) - parseFloat(selectedBookingDetails.amountPaid || 0)).toFixed(2)}</p>
                <p><strong>Payment Status:</strong><span className={`px-2 inline-flex text-m leading-5 font-semibold rounded-full ${
                    typeof selectedBookingDetails.isPaid === 'boolean'
                        ? (selectedBookingDetails.isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
                        : (selectedBookingDetails.isPaid === 'Fully Paid' ? 'bg-green-100 text-green-800' :
                           selectedBookingDetails.isPaid === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                           'bg-red-100 text-red-800')
                }`}>
                    {typeof selectedBookingDetails.isPaid === 'boolean'
                        ? (selectedBookingDetails.isPaid ? 'Yes' : 'No')
                        : selectedBookingDetails.isPaid}
                </span>
                </p>
                <p><strong>Late Check-out Fee:</strong> ₱{parseFloat(selectedBookingDetails.lateCheckOutFee || 0).toFixed(2)}</p>
                <p><strong>Early Check-in Fee:</strong> ₱{parseFloat(selectedBookingDetails.earlyCheckInFee || 0).toFixed(2)}</p>
                <p><strong>Discount Type:</strong> {selectedBookingDetails.discount_type || 'N/A'}</p>
                <p><strong>Discount Amount:</strong> ₱{parseFloat(selectedBookingDetails.discount_amount || 0).toFixed(2)}</p>
              </div>

            </div>
            <div className="flex justify-end mt-6">
                <button
                    onClick={handleCloseDetailsModal}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ease-in-out"
                >
                    Close
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
