import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Presentation } from '@/types';

// Define the type for toast
type ToastFunction = {
  (props: {
    title: string;
    description: string;
    variant?: "default" | "destructive" | undefined;
  }): void;
};

// Interface for presentation data when checking for duplicates
interface PresentationWithId extends Presentation {
  id: string;
  paperId?: string;
}

export const bulkImportConferencePresentations = async (toast: ToastFunction) => {
  // Get existing presentations to check for duplicates
  const snapshot = await getDocs(collection(db, 'presentations'));
  const existingPresentations = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as PresentationWithId[];

  const conferencePresentations = [
    // DAY 1 - MORNING SESSION (AZANIA ROOM)
    {
      title: "Performance Analysis of Deep Learning Techniques in Brain Tumor Segmentation",
      authors: ["Kevin Moorgas", "Nelendran Pillay", "Shaveen Maharaj"],
      abstract: "This research analyzes the performance of various deep learning techniques for brain tumor segmentation in medical imaging.",
      room: "AZANIA",
      sessionDate: "2025-07-23",
      startTime: "10h50",
      endTime: "11h15",
      paperId: "1571139421"
    },
    // ...many more presentations...
    
    // Adding the missing presentations
    {
      title: "From Insight to Action: Exploring Strategic Responses to Digital Decarbonization",
      authors: ["Hanlie Smuts"],
      abstract: "Strategic analysis of digital decarbonization responses and their implementation in organizations.",
      room: "AZANIA",
      sessionDate: "2025-07-24", 
      startTime: "11h10",
      endTime: "11h35",
      paperId: "1571149454"
    },
    {
      title: "Corporate environmental performance (CEP) and corporate financial performance: A systematic review",
      authors: ["Mziwendoda Cyprian Kubakisa", "Witesyavwirwa Vianney Kambale", "Isaac Lukusa Kayembe", "Mahmoud Hamed", "Roméo Miantezolo", "Kyandoghere Kyamakya"],
      abstract: "Systematic review of the relationship between corporate environmental performance and financial performance.",
      room: "ALOE",
      sessionDate: "2025-07-24",
      startTime: "16h30",
      endTime: "16h55",
      paperId: "1571158298"
    },
    {
      title: "Analysis and Mitigation of Harmonics on Distribution Systems with Nonlinear loads",
      authors: ["Saheed Lekan Gbadamosi", "Oyeniyi Akeem Alimi", "Oladipo Folorunso", "Osonuga Babajide Taiwo", "John Oluwaseun Babalola", "Oyedele Olusola Joel"],
      abstract: "Analysis and mitigation strategies for harmonics in distribution systems with nonlinear loads.",
      room: "CYCAD",
      sessionDate: "2025-07-24",
      startTime: "16h30",
      endTime: "16h55",
      paperId: "1571149578"
    },
    {
      title: "Appropriation of Artificial Intelligence in an E-learning Institution to Enhance Teaching and Learning",
      authors: ["Siphamandla Mncube"],
      abstract: "Analysis of artificial intelligence appropriation in e-learning institutions for enhanced teaching and learning.",
      room: "KHANYA",
      sessionDate: "2025-07-24",
      startTime: "16h30",
      endTime: "16h55",
      paperId: "1571151932"
    },
    {
      title: "Bus Voltage Regulation of a DC Microgrid using Cascade PID Control",
      authors: ["Sagadevan M. Kanniappen", "Nelendran Pillay", "Ian J. Lazarus"],
      abstract: "Implementation of cascade PID control for bus voltage regulation in DC microgrid systems.",
      room: "ALOE", 
      sessionDate: "2025-07-25",
      startTime: "11h10",
      endTime: "11h35",
      paperId: "1571154781"
    },
    {
      title: "Emerging Scholar Paper: A Bibliometric Analysis on the Adoption of The Bloomberg Terminal: Trends, Gaps, and Future Direction",
      authors: ["Q Mthethwa", "Ferina Marimuthu", "Sunday Ojo"],
      abstract: "Bibliometric analysis of Bloomberg Terminal adoption trends, research gaps, and future directions.",
      room: "KHANYA",
      sessionDate: "2025-07-25",
      startTime: "12h00",
      endTime: "12h25",
      paperId: "1571148519"
    },
    {
      title: "Performance Analysis of ML Algorithms for Fraud Detection in Digital Financial Transactions",
      authors: ["Deborah Oluwadele", "Sikwebu Malusi"],
      abstract: "Performance analysis of machine learning algorithms for fraud detection in digital financial transactions.",
      room: "CYCAD",
      sessionDate: "2025-07-25",
      startTime: "14h25",
      endTime: "14h50",
      paperId: "1571126276"
    },
    {
      title: "Innovative Design of Transmission Schemes for a Multi-Connective User Equipment in an Integrated Satellite-Terrestrial Network",
      authors: ["Oluwatobiloba Alade Ayofe", "Aliyu Danjuma Usman", "Sani Man Yahaya", "Mu'azu Jibrin Musa", "Zanna Mohammed Abdullahi", "Abdoulie Momodu S. Tekanyi", "Emmanuel Adotse Otsapa"],
      abstract: "Innovative transmission scheme design for multi-connective user equipment in integrated satellite-terrestrial networks.",
      room: "KHANYA",
      sessionDate: "2025-07-25",
      startTime: "14h25",
      endTime: "14h50",
      paperId: "1571135586"
    }
  ];

  let imported = 0;
  let skipped = 0;
  
  for (const presentation of conferencePresentations) {
    // Check if presentation already exists by paperId or title
    const existingByPaperId = existingPresentations.find(p => p.paperId === presentation.paperId);
    const existingByTitle = existingPresentations.find(p => 
      p.title?.toLowerCase().trim() === presentation.title.toLowerCase().trim()
    );
    
    if (existingByPaperId || existingByTitle) {
      skipped++;
      console.log(`Skipping duplicate: ${presentation.title}`);
      continue;
    }
    
    // Include paperId in the data to store for future duplicate checking
    const presentationData = {
      title: presentation.title,
      authors: presentation.authors,
      abstract: presentation.abstract,
      room: presentation.room,
      sessionDate: presentation.sessionDate,
      startTime: presentation.startTime,
      endTime: presentation.endTime,
      paperId: presentation.paperId
    };
    
    await addDoc(collection(db, 'presentations'), presentationData);
    imported++;
  }
  
  const message = skipped > 0 
    ? `Successfully imported ${imported} presentations. Skipped ${skipped} duplicates.`
    : `Successfully imported ${imported} conference presentations`;
  
  toast({
    title: "Import Complete",
    description: message,
  });
  
  return { imported, skipped };
};
