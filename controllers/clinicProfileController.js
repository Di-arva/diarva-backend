const Clinic = require("../models/Clinic");

const getProfile = async (req, res) => {
  try {

    const userId = req.user.sub || req.user.id; 
    

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    // Try to find clinic by user_id
    let clinic = await Clinic.findOne({ user_id: userId });
    console.log("Clinic found by user_id:", clinic);

    // If not found, try to find by user email or other criteria
    if (!clinic) {
      console.log("No clinic found with user_id:", userId);
      console.log("Trying to find clinic by user email...");
      
      clinic = await Clinic.findOne({ 
        $or: [
          { 'contact.email': req.user.email },
          { 'clinic_name': { $regex: req.user.name || '', $options: 'i' } }
        ]
      });
      console.log("Clinic found by alternative search:", clinic);
    }

    if (!clinic) {
      console.log("No clinic profile found for this user");
      return res.status(404).json({
        success: false,
        message: "Clinic profile not found for this user",
        clinic_name: "",
        business_number: "",
        address: {
          address_line: "",
          city: "",
          province: "",
          postal_code: "",
        },
        contact: {
          phone: "",
          fax: "",
          website: ""
        },
        parking_info: {
          type: "",
          details: ""
        }
      });
    }

    console.log("Successfully found clinic profile:", clinic.clinic_name);
    res.status(200).json({
      success: true,
      ...clinic.toObject()
    });

  } catch (error) {
    console.error("Get clinic profile error:", error);
    console.error("Error stack:", error.stack); // Add stack trace
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinic profile",
      error: error.message
    });
  }
};
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id; // Use the correct property
    const { parking_info } = req.body;

   

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    let clinic = await Clinic.findOne({ user_id: userId });
    
    if (!clinic) {
      console.log("No clinic found with user_id:", userId);
      return res.status(404).json({
        success: false,
        message: "Clinic profile not found"
      });
    }

    // Update parking info
    if (parking_info) {
      clinic.parking_info = {
        ...clinic.parking_info,
        ...parking_info
      };
    }

    await clinic.save();
    console.log("Updated clinic parking info:", clinic.parking_info);

    res.status(200).json({
      success: true,
      message: "Parking information updated successfully",
      clinic: clinic
    });

  } catch (error) {
    console.error("Update clinic profile error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to update clinic profile",
      error: error.message
    });
  }
};

const getPublicProfile = async (req, res) => {
  try {
    const { clinicId } = req.params;
    console.log("Getting public profile for clinic:", clinicId);

    const clinic = await Clinic.findById(clinicId)
      .select('-license_info -business_number -verification_status');

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic profile not found"
      });
    }

    res.status(200).json({
      success: true,
      clinic: clinic
    });
  } catch (error) {
    console.error("Get public clinic profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinic profile",
      error: error.message
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getPublicProfile
};