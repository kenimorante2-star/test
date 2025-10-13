// FeedbacksPage.jsx
import React, { useState, useEffect, useCallback } from 'react';

// Re-use your StarRating component
const StarRating = ({ rating }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <svg
        key={i}
        className={`w-5 h-5 ${i <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.927 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
      </svg>
    );
  }
  return <div className="flex">{stars}</div>;
};

// Re-use your Title component
const Title = ({ title, subTitle }) => {
  return (
    <div className="text-center mb-10">
      <h2 className="text-4xl font-playfair font-bold text-gray-900">{title}</h2>
      <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">{subTitle}</p>
    </div>
  );
};

const FeedbacksPage = ({ showModal }) => {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;// IMPORTANT: Keep this consistent with your Testimonial.jsx!




const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTestimonial(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

   const handleRatingChange = (newRating) => {
    setNewTestimonial(prevState => ({
      ...prevState,
      rating: newRating
    }));
  };

  const fetchAllTestimonials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/testimonials`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTestimonials(data);
    } catch (err) {
      console.error("Error fetching all testimonials:", err);
      setError("Failed to load all testimonials. Please try again later.");
       if (typeof showModal === 'function') {
        showModal("Failed to load all testimonials. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  }, [showModal]);

  useEffect(() => {
    fetchAllTestimonials();
  }, [fetchAllTestimonials]);

   const [newTestimonial, setNewTestimonial] = useState({
      name: '',
      review: '',
      rating: 5,
      address: '',
    });

    const fetchTestimonials = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(`${API_BASE_URL}/api/testimonials`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setTestimonials(data);
        } catch (err) {
          console.error("Error fetching testimonials:", err);
          setError("Failed to load testimonials. Please try again later.");
          if (typeof showModal === 'function') {
            showModal("Failed to load testimonials. Please try again later.");
          }
        } finally {
          setLoading(false);
        }
      }, [showModal]);
    
      useEffect(() => {
        fetchTestimonials();
      }, [fetchTestimonials]);

  const handleSubmitTestimonial = async (e) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    try {
      const response = await fetch(`${API_BASE_URL}/api/testimonials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTestimonial.name,
          address: newTestimonial.address,
          review: newTestimonial.review,
          rating: parseInt(newTestimonial.rating, 10), // Ensure rating is an integer
          image_url: `https://placehold.co/48x48/aabbcc/ffffff?text=${newTestimonial.name.charAt(0).toUpperCase()}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json(); // Backend might send error details
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      setNewTestimonial({ name: '', review: '', rating: 5, address: '' }); // Clear form
      if (typeof showModal === 'function') {
        showModal("Testimonial submitted successfully!");
      }
      fetchTestimonials(); // Re-fetch testimonials to show the new one
    } catch (err) {
      console.error("Error adding testimonial:", err);
      setError(`Failed to submit testimonial: ${err.message}`);
      if (typeof showModal === 'function') {
        showModal(`Failed to submit testimonial: ${err.message}`);
      }
    }
  };

  return (
    <div className='flex flex-col items-center px-6 md:px-16 lg:px-24 bg-slate-50 pt-20 mt-10 font-inter min-h-screen'>
      <Title
        title="All Guest Feedbacks"
        subTitle="Read all the valuable feedback from our esteemed guests at Sanjh Island Hotel."
      />

      <div className="flex flex-wrap justify-center gap-6 mt-10 w-full max-w-6xl">
        {loading && <p className="text-gray-600 text-lg">Loading feedbacks...</p>}
        {error && <p className="text-red-600 text-lg">{error}</p>}
        {!loading && !error && testimonials.length === 0 && (
          <p className="text-gray-600 text-lg">No feedbacks available yet.</p>
        )}
        {!loading && !error && testimonials.length > 0 && (
          testimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-white p-6 rounded-xl shadow-lg flex flex-col w-full sm:w-80 md:w-96">
              <div className="flex items-center gap-3">
                <img
                  className="w-12 h-12 rounded-full object-cover"
                  src={testimonial.image_url || `https://placehold.co/48x48/aabbcc/ffffff?text=${testimonial.name.charAt(0).toUpperCase()}`}
                  alt={testimonial.name}
                  onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/48x48/aabbcc/ffffff?text=User`; }}
                />
                <div>
                  <p className="font-playfair text-xl font-semibold text-gray-800">{testimonial.name}</p>
                  <p className="text-gray-500 text-sm">{testimonial.address}</p>
                </div>
              </div>
              <div className="mt-4">
                <StarRating rating={testimonial.rating} />
              </div>
              <p className="text-gray-700 mt-4 flex-grow">"{testimonial.review}"</p>
            </div>
          ))
        )}
      </div>
      <div className="mt-20 w-full max-w-2xl bg-white p-8 rounded-xl shadow-lg">
        <h3 className="text-2xl font-playfair font-bold text-gray-900 mb-6 text-center">Leave Your Feedback</h3>
        <form onSubmit={handleSubmitTestimonial} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Your Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={newTestimonial.name}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">Your Location (e.g., City, Country)</label>
            <input
              type="text"
              id="address"
              name="address"
              value={newTestimonial.address}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="review" className="block text-sm font-medium text-gray-700">Your Review</label>
            <textarea
              id="review"
              name="review"
              value={newTestimonial.review}
              onChange={handleInputChange}
              rows="4"
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            ></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Rating</label>
            <div className="flex items-center mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className={`w-8 h-8 cursor-pointer ${star <= newTestimonial.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  onClick={() => handleRatingChange(star)}
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.927 8.72c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-300"
          >
            Submit Testimonial
          </button>
        </form>
      </div>
    </div>
    
  );
};

export default FeedbacksPage;