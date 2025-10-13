// src/pages/AboutUs.jsx (or wherever you prefer to place your page components)
import React from 'react';
// Assuming you have a Title component and assets are accessible globally or via props
import Title from '../components/Title'; // Adjust path if necessary
import { assets } from '../assets/assets'; // Adjust path if necessary

const AboutUs = () => {
    return (
        <div className="container mx-auto px-4 py-12 md:py-16 lg:py-20 mt-15">
            {/* Hero Section */}
            <div className="text-center mb-12 md:mb-16">
                <Title
                    title="About Sanjh Island Hotel"
                    subTitle="Discover Our Story, Passion, and Commitment to Your Perfect Stay"
                />
                <p className="max-w-3xl mx-auto text-lg text-gray-700 mt-6 leading-relaxed">
                    Welcome to Sanjh Island Hotel, where unparalleled luxury meets the serene beauty of island life. We are dedicated to providing an escape that rejuvenates your spirit and creates unforgettable memories.
                </p>
            </div>

            {/* Our Story Section */}
            <section className="bg-white rounded-lg shadow-xl p-8 md:p-12 mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-800 text-center mb-6">Our Story</h2>
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="md:w-1/2">
                        {/* You can add an image here relevant to your hotel's history or origin */}
                        {/* <img src={assets.yourHistoryImage} alt="Hotel History" className="rounded-lg shadow-md w-full h-auto object-cover" /> */}
                         {/* Placeholder for your image. Replace with an actual asset */}
                         <img src={assets.ourImage} alt="Our Story" className="rounded-lg shadow-md w-full h-64 object-cover" />
                    </div>
                    <div className="md:w-1/2 text-gray-700 leading-relaxed">
                        <p className="mb-4">
                            Born from a dream to blend sophisticated comfort with authentic island charm, Sanjh Island Hotel opened its doors in [Year Founded]. Our founders envisioned a sanctuary where guests could immerse themselves in breathtaking natural beauty without compromising on luxury and personalized service.
                        </p>
                        <p>
                            Over the years, we have grown and evolved, constantly enhancing our offerings while staying true to our roots. Every stone laid and every plant nurtured contributes to the unique ambiance that defines Sanjh, making it a beloved destination for travelers seeking tranquility and adventure.
                        </p>
                    </div>
                </div>
            </section>

            {/* Our Mission & Values Section */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-8">
                    <h3 className="text-2xl font-semibold text-blue-800 mb-4">Our Mission</h3>
                    <p className="text-blue-700 leading-relaxed">
                        Our mission at Sanjh Island Hotel is to craft exceptional and memorable experiences for every guest. We strive to exceed expectations through meticulous attention to detail, personalized service, and a deep respect for the natural environment that surrounds us. We aim to be a beacon of hospitality, offering a haven where relaxation and adventure coexist.
                    </p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-md p-8">
                    <h3 className="text-2xl font-semibold text-green-800 mb-4">Our Core Values</h3>
                    <ul className="list-disc list-inside text-green-700 leading-relaxed">
                        <li>Excellence: Delivering the highest standards in every aspect of our service.</li>
                        <li>Integrity: Operating with honesty, transparency, and ethical practices.</li>
                        <li>Sustainability: Protecting our pristine island environment for future generations.</li>
                        <li>Guest Focus: Anticipating and fulfilling the unique needs of each guest.</li>
                        <li>Community: Contributing positively to the local community and culture.</li>
                    </ul>
                </div>
            </section>

            {/* The Sanjh Experience Section */}
            <section className="bg-gray-50 rounded-lg shadow-xl p-8 md:p-12 mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-800 text-center mb-6">The Sanjh Experience</h2>
                <p className="text-gray-700 text-center max-w-4xl mx-auto mb-8 leading-relaxed">
                    From the moment you arrive, you'll discover why Sanjh Island Hotel is more than just a place to stay—it's a destination designed to inspire. Indulge in our luxurious accommodations, savor exquisite culinary delights, and explore a myriad of activities from pristine beaches to vibrant coral reefs. Our dedicated team is committed to making your stay seamless and extraordinary.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-6 bg-white rounded-lg shadow-md">
                        <img src={assets.accomodation} alt="Luxury Accommodations" className="w-16 h-16 mx-auto mb-4 opacity-70" />
                        <h4 className="text-xl font-semibold text-gray-800 mb-2">Luxury Accommodations</h4>
                        <p className="text-gray-600">Experience comfort and elegance in our beautifully designed rooms and villas.</p>
                    </div>
                    <div className="text-center p-6 bg-white rounded-lg shadow-md">
                        <img src={assets.roomServiceIcon} alt="Culinary Delights" className="w-16 h-16 mx-auto mb-4 opacity-70" />
                        <h4 className="text-xl font-semibold text-gray-800 mb-2">Exquisite Dining</h4>
                        <p className="text-gray-600">Savor local and international cuisine prepared with the freshest ingredients.</p>
                    </div>
                    <div className="text-center p-6 bg-white rounded-lg shadow-md">
                        <img src={assets.poolIcon} alt="Island Activities" className="w-16 h-16 mx-auto mb-4 opacity-70" />
                        <h4 className="text-xl font-semibold text-gray-800 mb-2">Endless Adventures</h4>
                        <p className="text-gray-600">From water sports to serene nature walks, discover something new every day.</p>
                    </div>
                </div>
            </section>

            {/* Call to Action */}
            <section className="text-center bg-blue-600 text-white rounded-lg p-8 md:p-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Island Escape Awaits</h2>
                <p className="text-lg mb-8 max-w-3xl mx-auto">
                    Ready to experience the magic of Sanjh Island Hotel? Book your stay today and embark on a journey of relaxation, discovery, and unparalleled hospitality.
                </p>
                <a
                    href="/rooms" // Link to your rooms or booking page
                    className="inline-block bg-white text-blue-600 font-semibold py-3 px-8 rounded-full shadow-lg hover:bg-gray-100 transition-colors duration-300 transform hover:scale-105"
                >
                    Explore Our Rooms
                </a>
            </section>
        </div>
    );
};

export default AboutUs;